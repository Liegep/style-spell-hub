import release1 from "@/assets/release-1.jpg";
import release2 from "@/assets/release-2.jpg";
import release3 from "@/assets/release-3.jpg";

export const releases = [
  {
    id: "velvet-04",
    name: "Velvet 04",
    category: "Gown · Mesh",
    img: release1,
    date: "MMXXVI · 03",
    note: "Casts a slow spell.",
  },
  {
    id: "lace-noir",
    name: "Lace Noir",
    category: "Bodysuit",
    img: release2,
    date: "MMXXVI · 03",
    note: "Lace, retraced.",
  },
  {
    id: "silk-touch",
    name: "Silk Touch",
    category: "Accessory set",
    img: release3,
    date: "MMXXVI · 02",
    note: "Pink, on pink, on pink.",
  },
  {
    id: "satin-spell",
    name: "Satin Spell",
    category: "Skirt",
    img: release1,
    date: "MMXXVI · 02",
    note: "A whisper.",
  },
];

export const bloggers = [
  { id: 1, name: "Aria Solstice",     status: "active",   posts: 4, last: "2d ago",  lang: "EN", frequency: "1/mo" },
  { id: 2, name: "Mireille Velour",   status: "active",   posts: 2, last: "5d ago",  lang: "ES", frequency: "1/mo" },
  { id: 3, name: "Naya Cassidy",      status: "inactive", posts: 0, last: "42d ago", lang: "EN", frequency: "—" },
  { id: 4, name: "Lumière Bisset",    status: "active",   posts: 3, last: "1d ago",  lang: "EN", frequency: "1/wk" },
  { id: 5, name: "Sasha Vermillion",  status: "warning",  posts: 1, last: "21d ago", lang: "ES", frequency: "1/mo" },
  { id: 6, name: "Iris D'Ambrosio",   status: "active",   posts: 5, last: "3d ago",  lang: "EN", frequency: "2/mo" },
  { id: 7, name: "Margaux Plume",     status: "pending",  posts: 0, last: "—",       lang: "ES", frequency: "—" },
  { id: 8, name: "Zelia Moreau",      status: "active",   posts: 2, last: "8d ago",  lang: "EN", frequency: "1/mo" },
];

export const products = [
  { id: "p1", name: "Velvet 04",    added: "12 days ago", expires: "78 days", img: release1, claims: 24 },
  { id: "p2", name: "Lace Noir",    added: "33 days ago", expires: "57 days", img: release2, claims: 18 },
  { id: "p3", name: "Silk Touch",   added: "61 days ago", expires: "29 days", img: release3, claims: 41 },
  { id: "p4", name: "Satin Spell",  added: "84 days ago", expires: "6 days",  img: release1, claims: 12 },
  { id: "p5", name: "Tulle Rose",   added: "91 days ago", expires: "Archive soon", img: release2, claims: 9 },
];

export const messages = [
  { id: 1, type: "broadcast", from: "Love Potion HQ", subject: "House rules — March update", time: "1h",  unread: true },
  { id: 2, type: "personal",  from: "Casteli (you)",   subject: "Loved your last set, Aria",  time: "5h",  unread: true },
  { id: 3, type: "personal",  from: "Casteli (you)",   subject: "Reminder: monthly post",     time: "1d",  unread: false },
  { id: 4, type: "broadcast", from: "Love Potion HQ", subject: "New drop: Velvet 04",        time: "3d",  unread: false },
];

export const applications = [
  { id: 1, name: "Lyra Hollow",       lang: "EN", flickr: "flickr.com/lyrahollow",       submitted: "2d ago"  },
  { id: 2, name: "Pilar Estrella",    lang: "ES", flickr: "flickr.com/pilarestrella",    submitted: "4d ago"  },
  { id: 3, name: "Camille Noir",      lang: "EN", flickr: "flickr.com/camillenoir",      submitted: "6d ago"  },
];

export const stats = {
  activeBloggers: 42,
  inactiveBloggers: 7,
  postsThisMonth: 118,
  productsLive: 23,
  archiveSoon: 4,
  subscribers: 1840,
};
