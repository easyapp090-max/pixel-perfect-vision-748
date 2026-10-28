import { getSupabaseClient } from "@/lib/supabase";
import { getSafeAuthError } from "@/lib/user-messages";

export type AccountRole = "customer" | "staff" | "admin" | "owner";
export type StorePermission =
  | "manage_products"
  | "manage_orders"
  | "view_customers"
  | "manage_discounts"
  | "manage_content"
  | "manage_settings";

export type CustomerSession = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: AccountRole;
  permissions: StorePermission[];
};

export type AuthResult = {
  ok: boolean;
  message: string;
  user?: CustomerSession;
  needsEmailVerification?: boolean;
  setupUserId?: string;
};

type ProfileRow = {
  full_name: string;
  phone: string | null;
};

type PermissionRow = {
  permission: string;
};

const storePermissions = new Set<StorePermission>([
  "manage_products",
  "manage_orders",
  "view_customers",
  "manage_discounts",
  "manage_content",
  "manage_settings",
]);

const rolePriority: AccountRole[] = ["owner", "staff", "admin", "customer"];

export function hasAdminAccess(
  session: Pick<CustomerSession, "role" | "permissions"> | null,
): boolean {
  if (!session) return false;
  return session.role === "owner" || session.permissions.length > 0;
}

function authErrorMessage(message: string): AuthResult {
  return { ok: false, message };
}

function authError(error: unknown): AuthResult {
  return authErrorMessage(getSafeAuthError(error));
}

async function currentUser() {
  const supabase = getSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error("Could not load the current session.");
  if (!sessionData.session) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error("Could not validate the current session.");
  return data.user;
}

async function customerSession(): Promise<CustomerSession | null> {
  const user = await currentUser();
  if (!user) return null;

  const supabase = getSupabaseClient();
  const [
    { data: profile, error: profileError },
    { data: roles, error: rolesError },
    { data: permissionRows, error: permissionsError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>(),
    supabase.from("app_roles").select("role").eq("user_id", user.id),
    supabase.from("store_permissions").select("permission").eq("user_id", user.id),
  ]);
  if (profileError) throw new Error("Could not load the account profile.");
  if (rolesError) throw new Error("Could not load account permissions.");
  if (permissionsError) throw new Error("Could not load account permissions.");
  if (!profile) throw new Error("The account profile is missing. Contact the store administrator.");

  const assignedRoles = new Set(roles?.map((row) => row.role));
  const role = rolePriority.find((candidate) => assignedRoles.has(candidate)) ?? "customer";
  const permissions = (permissionRows ?? [])
    .map((row) => row.permission)
    .filter((permission): permission is StorePermission =>
      storePermissions.has(permission as StorePermission),
    );
  return {
    id: user.id,
    fullName: profile.full_name,
    email: user.email ?? "",
    phone: profile.phone ?? "",
    role,
    permissions,
  };
}

export async function getCurrentCustomer() {
  return customerSession();
}

export async function getCurrentAdminSession() {
  const session = await customerSession();
  return session && ["owner", "admin", "staff"].includes(session.role) ? session : null;
}

export async function signOutCustomer(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw new Error("Could not sign out.");
}

export const signOutAdmin = signOutCustomer;

export async function registerCustomer(input: {
  fullName: string;
  email: string;
  password: string;
  phone: string;
}): Promise<AuthResult> {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  if (!fullName || !email || !phone || !input.password) {
    return authErrorMessage("Please complete all fields to create your account.");
  }

  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password: input.password,
    options: {
      data: { full_name: fullName, phone },
      emailRedirectTo: `${window.location.origin}/account`,
    },
  });
  if (error) return authError(error);
  if (!data.session) {
    return {
      ok: true,
      message: "Check your email to verify your account before signing in.",
      needsEmailVerification: true,
    };
  }

  const user = await customerSession();
  return {
    ok: true,
    message: "Account created successfully.",
    ...(user ? { user } : {}),
  };
}

export async function signInCustomer(email: string, password: string): Promise<AuthResult> {
  const { error } = await getSupabaseClient().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) return authError(error);
  const user = await customerSession();
  if (!user) return authErrorMessage("The authenticated account profile is unavailable.");
  return { ok: true, message: "Signed in successfully.", user };
}

export async function signInAdmin(email: string, password: string): Promise<AuthResult> {
  const result = await signInCustomer(email, password);
  if (!result.ok) return result;
  if (!result.user || !["owner", "admin", "staff"].includes(result.user.role)) {
    await signOutCustomer();
    return authErrorMessage("These credentials are not authorized for administrator access.");
  }
  return { ...result, message: "Administrator signed in successfully." };
}

export async function isFirstOwnerSetupAvailable(): Promise<boolean> {
  const { data, error } = await getSupabaseClient().rpc("first_owner_setup_available");
  if (error) throw new Error("Could not check first-owner setup status.");
  return data === true;
}

export async function registerFirstOwner(input: {
  fullName: string;
  email: string;
  password: string;
  confirmation: string;
}): Promise<AuthResult> {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  if (fullName.length < 2 || !email || input.password.length < 8) {
    return authErrorMessage("أدخل الاسم والبريد الإلكتروني الصحيح وكلمة مرور من 8 أحرف على الأقل.");
  }
  if (input.password !== input.confirmation) {
    return authErrorMessage("كلمتا المرور غير متطابقتين.");
  }

  try {
    if (!(await isFirstOwnerSetupAvailable())) {
      return authErrorMessage("تم إعداد المالك الأول بالفعل.");
    }

    const { data, error } = await getSupabaseClient().auth.signUp({
      email,
      password: input.password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/admin/setup-owner`,
      },
    });
    if (error) return authError(error);
    if (!data.user) return authErrorMessage("تعذر إنشاء الحساب. حاول مرة أخرى.");
    if (!data.session) {
      return {
        ok: true,
        message: `تم إنشاء الحساب بالمعرّف ${data.user.id}. أكّد بريدك الإلكتروني، ثم اطلب من مسؤول قاعدة بيانات موثوق منح صلاحية المالك عبر supabase/first-owner.sql.`,
        needsEmailVerification: true,
        setupUserId: data.user.id,
      };
    }
    const user = await customerSession();
    return {
      ok: true,
      message: `تم التحقق من الحساب. أرسل معرّف المستخدم هذا إلى مسؤول قاعدة بيانات موثوق لإكمال الإعداد: ${data.user.id}`,
      ...(user ? { user } : {}),
      setupUserId: data.user.id,
    };
  } catch (cause) {
    return authError(cause);
  }
}

export async function sendPasswordRecovery(email: string): Promise<AuthResult> {
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return error
    ? authError(error)
    : { ok: true, message: "If an account exists for that address, a reset link has been sent." };
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const { error } = await getSupabaseClient().auth.updateUser({ password });
  return error ? authError(error) : { ok: true, message: "Password updated successfully." };
}

export async function isCustomerSignedIn() {
  return Boolean(await getCurrentCustomer());
}

export async function isAdminSignedIn() {
  return Boolean(await getCurrentAdminSession());
}
