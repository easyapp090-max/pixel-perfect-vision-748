import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/size-guide")({ component: SizeGuidePage });

function SizeGuidePage() {
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-12 md:px-8">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Size guide
      </p>
      <h1 className="mt-4 font-display text-5xl uppercase md:text-7xl">Find the right fit</h1>
      <div className="mt-8 overflow-hidden border">
        <table className="w-full text-left text-sm">
          <thead className="bg-card">
            <tr>
              <th className="p-3">Size</th>
              <th className="p-3">Chest</th>
              <th className="p-3">Waist</th>
              <th className="p-3">Length</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["S", "92cm", "76cm", "68cm"],
              ["M", "98cm", "82cm", "70cm"],
              ["L", "104cm", "88cm", "72cm"],
              ["XL", "110cm", "94cm", "74cm"],
            ].map(([size, chest, waist, length]) => (
              <tr key={size} className="border-t">
                <td className="p-3 font-medium uppercase">{size}</td>
                <td className="p-3">{chest}</td>
                <td className="p-3">{waist}</td>
                <td className="p-3">{length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
