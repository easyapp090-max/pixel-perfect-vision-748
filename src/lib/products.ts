import hero from "@/assets/hero.jpg";
import men from "@/assets/men.jpg";
import women from "@/assets/women.jpg";
import acc from "@/assets/acc.jpg";
import tee from "@/assets/tee.jpg";
import jeans from "@/assets/jeans.jpg";

export const images = { hero, men, women, acc, tee, jeans };

export type Product = {
  id: string;
  name: string;
  cat: string;
  price: number;
  sale?: number;
  img: string;
  pos?: string;
  tag?: string;
};

export const newDrops: Product[] = [
  { id: "n1", name: "Fracture Tee — Washed Black", cat: "T-Shirts", price: 1150, img: tee, tag: "NEW" },
  { id: "n2", name: "Split-Knee Wide Jeans", cat: "Jeans", price: 2450, sale: 1990, img: jeans, tag: "NEW" },
  { id: "n3", name: "Raw Edge Denim Jacket", cat: "Jackets", price: 3600, img: hero, pos: "50% 45%", tag: "NEW" },
  { id: "n4", name: "Column Maxi Dress", cat: "Dresses", price: 2800, img: women, pos: "50% 60%", tag: "NEW" },
];

export const bestSellers: Product[] = [
  { id: "b1", name: "Root Graphic Oversized Tee", cat: "T-Shirts", price: 990, sale: 790, img: men, pos: "50% 35%" },
  { id: "b2", name: "Cargo Parachute Pant", cat: "Pants", price: 2100, img: men, pos: "50% 80%" },
  { id: "b3", name: "Tread Runner — Triple Black", cat: "Shoes", price: 4200, sale: 3490, img: acc, pos: "30% 50%" },
  { id: "b4", name: "Curb Chain 6mm", cat: "Accessories", price: 650, img: acc, pos: "40% 85%" },
];

export const categories = [
  { name: "Men", ar: "رجالي", img: men, pos: "50% 30%" },
  { name: "Women", ar: "حريمي", img: women, pos: "50% 25%" },
  { name: "Jackets", ar: "جواكت", img: hero, pos: "50% 40%" },
  { name: "Accessories", ar: "إكسسوار", img: acc, pos: "50% 50%" },
];

export const allCats = [
  "Men", "Women", "Kids", "T-Shirts", "Shirts", "Pants", "Jeans",
  "Dresses", "Sets", "Jackets", "Shoes", "Accessories", "Coming Soon",
];

export const egp = (n: number) => `EGP ${n.toLocaleString("en-US")}`;
