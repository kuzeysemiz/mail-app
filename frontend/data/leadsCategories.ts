export type CategoryOption =
  | { id: string; label: string; type: "stars" }
  | { id: string; label: string; type: "select"; choices: string[] };

export type Category = {
  id: string;
  label: string;
  query: string;
  options?: CategoryOption[];
};

export const LEAD_CATEGORIES: Category[] = [
  { id: "restoran",  label: "Restoran",        query: "restoran" },
  {
    id: "otel",
    label: "Otel",
    query: "otel",
    options: [{ id: "hotelStars", label: "Minimum Yıldız", type: "stars" }],
  },
  { id: "kafe",         label: "Kafe",            query: "kafe" },
  { id: "dis-klinigi",  label: "Diş Kliniği",     query: "diş kliniği" },
  { id: "guzellik",     label: "Güzellik Salonu",  query: "güzellik salonu kuaför" },
  { id: "spor",         label: "Spor Salonu",      query: "spor salonu fitness" },
  { id: "eczane",       label: "Eczane",           query: "eczane" },
  { id: "avukat",       label: "Avukat",           query: "avukat hukuk bürosu" },
  { id: "muhasebe",     label: "Muhasebe",         query: "muhasebe mali müşavir" },
  { id: "emlak",        label: "Emlakçı",          query: "emlak ofisi" },
  { id: "oto-servis",   label: "Oto Servis",       query: "oto servis tamirci" },
  { id: "ozel-okul",    label: "Özel Okul / Dershane", query: "özel okul dershane" },
];
