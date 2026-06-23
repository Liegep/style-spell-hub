import { useLocation, useParams } from "@tanstack/react-router";

export type Lang = "en" | "es";

export const dict = {
  en: {
    brand: "Love Potion",
    slogan: "Style that casts a spell.",
    edition: "Nº I · LOVE POTION · MMXXVI",
    nav: {
      home: "Home",
      about: "About",
      releases: "Releases",
      shop: "Shop info",
      newsletter: "Newsletter",
      links: "Links",
      apply: "Apply",
      login: "Login",
    },
    hero: {
      kicker: "A house of fashion for Second Life.",
      headline_top: "LOVE",
      headline_bottom: "POTION",
      handwritten: "the spell",
      sub: "Mesh-aware couture, accessories & moods for the avatars who already know.",
      ctaBlogger: "Blogger Login",
      ctaApply: "Apply to blog",
      scroll: "Scroll",
    },
    socials: { flickr: "Flickr", mp: "SL Marketplace", fb: "Facebook", primfeed: "Primfeed" },
    about: {
      title: "About the house",
      kicker: "Manifesto",
      note: "since MMXXVI",
      caption: "Fig. 01 — The first potion.",
      body1:
        "Love Potion was born in a dim corner of the grid, mixing satin, smoke and code. We dress avatars for the moments they actually remember — the slow dance, the long walk home, the first photograph.",
      body2:
        "Every piece is rigged, retextured and obsessed-over until it moves like real silk on a real shoulder. We are a small studio. We answer our own messages. We adore our bloggers.",
      pull: "Style that casts a spell.",
    },
    releases: {
      title: "Latest spells",
      kicker: "Nº 04 · MMXXVI",
      cta: "Open the lookbook",
      newTag: "New drop",
    },
    shop: {
      title: "Where to find us",
      mainstore: "Mainstore",
      mainstoreVal: "Love Potion · Second Life",
      mp: "Marketplace",
      mpVal: "marketplace.secondlife.com/love-potion",
      group: "Group gift",
      groupVal: "Free for VIP members — join in-world.",
      copy:
        "We deliver in-world, instantly. Try a demo before you cast — every potion has one.",
    },
    newsletter: {
      title: "Newsletter",
      kicker: "Texts that arrive with a photo, straight to your inbox in Second Life.",
      placeholder: "Your SL avatar name",
      cta: "Cast me in",
      preview: "Preview of how a release arrives",
      sampleTitle: "Velvet 04 has arrived",
      sampleBody: "A new gown, four colors, fitted for every body. Try the demo at the mainstore.",
    },
    apply: {
      title: "Apply to blog",
      kicker: "Form · 12 questions",
      intro:
        "Tell us who you are and where your photographs live. We read every application by hand.",
      loading: "Loading applications",
      closedKicker: "Applications paused",
      closedTitle: "Our blogger list is full for now.",
      closedBody:
        "We are not opening new blogger applications at the moment. Please keep visiting the store and the website — when Love Potion opens new spots, this page will bloom again.",
      closedNote: "come back soon",
      sl: "SL avatar name",
      mail: "Contact email",
      flickr: "Flickr URL",
      fb: "Facebook / Instagram",
      cam: "Camera & post style",
      why: "Why Love Potion?",
      languages: "Languages you speak",
      hours: "Hours you spend in-world weekly",
      submit: "Send my application",
      note: "We answer within 7 days.",
    },
    login: {
      title: "Step inside",
      access: "Secure atelier access",
      kicker: "Select your role",
      blogger: "Blogger",
      admin: "Admin",
      super: "Super Admin",
      mail: "Email",
      identifier: "Avatar name (or email)",
      pass: "Password",
      remember: "Remember me",
      cta: "Enter the house",
      forgot: "Forgot password?",
      loading: "Opening...",
      handwritten: "welcome",
      missingProfile: "Your login exists, but your profile row was not found.",
      leftAccount: "This blogger account is no longer active.",
      failed: "Login failed. Please try again.",
    },
    app: {
      logout: "Sign out",
      preview: "Preview only — wire backend later.",
    },
  },
  es: {
    brand: "Love Potion",
    slogan: "Un estilo que lanza un hechizo.",
    edition: "Nº I · LOVE POTION · MMXXVI",
    nav: {
      home: "Inicio",
      about: "Sobre",
      releases: "Lanzamientos",
      shop: "Cómo comprar",
      newsletter: "Newsletter",
      links: "Links",
      apply: "Aplicar",
      login: "Entrar",
    },
    hero: {
      kicker: "Una casa de moda para Second Life.",
      headline_top: "LOVE",
      headline_bottom: "POTION",
      handwritten: "el hechizo",
      sub: "Alta costura mesh, accesorios y atmósferas para las avatares que ya saben.",
      ctaBlogger: "Entrar como blogger",
      ctaApply: "Aplicar para bloguear",
      scroll: "Desliza",
    },
    socials: { flickr: "Flickr", mp: "Marketplace SL", fb: "Facebook", primfeed: "Primfeed" },
    about: {
      title: "Sobre la casa",
      kicker: "Manifiesto",
      note: "desde MMXXVI",
      caption: "Fig. 01 — La primera poción.",
      body1:
        "Love Potion nació en un rincón tenue del grid, mezclando satén, humo y código. Vestimos avatares para los momentos que de verdad recuerdan — el baile lento, el camino a casa, la primera fotografía.",
      body2:
        "Cada pieza se rigea, se retextura y se obsesiona hasta moverse como seda real sobre un hombro real. Somos un estudio pequeño. Respondemos nuestros mensajes. Adoramos a nuestras bloggers.",
      pull: "Un estilo que lanza un hechizo.",
    },
    releases: {
      title: "Últimos hechizos",
      kicker: "Nº 04 · MMXXVI",
      cta: "Abrir el lookbook",
      newTag: "Nuevo",
    },
    shop: {
      title: "Dónde encontrarnos",
      mainstore: "Tienda principal",
      mainstoreVal: "Love Potion · Second Life",
      mp: "Marketplace",
      mpVal: "marketplace.secondlife.com/love-potion",
      group: "Regalo de grupo",
      groupVal: "Gratis para miembros VIP — únete in-world.",
      copy:
        "Entregamos in-world, al instante. Prueba un demo antes de lanzar el hechizo — toda poción tiene uno.",
    },
    newsletter: {
      title: "Newsletter",
      kicker: "Textos que llegan con una foto, directo a tu inbox en Second Life.",
      placeholder: "Tu nombre de avatar SL",
      cta: "Suscribirme",
      preview: "Vista previa de cómo llega un lanzamiento",
      sampleTitle: "Velvet 04 ha llegado",
      sampleBody: "Un nuevo vestido, cuatro colores, ajustado a cada cuerpo. Prueba el demo en la tienda.",
    },
    apply: {
      title: "Aplicar para bloguear",
      kicker: "Formulario · 12 preguntas",
      intro:
        "Cuéntanos quién eres y dónde viven tus fotografías. Leemos cada aplicación a mano.",
      loading: "Cargando aplicaciones",
      closedKicker: "Aplicaciones pausadas",
      closedTitle: "Nuestra lista de bloggers está llena por ahora.",
      closedBody:
        "En este momento no estamos abriendo nuevas aplicaciones para bloggers. Sigue visitando la tienda y el sitio — cuando Love Potion abra nuevos cupos, esta página volverá a florecer.",
      closedNote: "vuelve pronto",
      sl: "Nombre de avatar SL",
      mail: "Email de contacto",
      flickr: "URL de Flickr",
      fb: "Facebook / Instagram",
      cam: "Cámara y estilo de edición",
      why: "¿Por qué Love Potion?",
      languages: "Idiomas que hablas",
      hours: "Horas semanales en SL",
      submit: "Enviar mi aplicación",
      note: "Respondemos en 7 días.",
    },
    login: {
      title: "Entra a la casa",
      access: "Acceso seguro al atelier",
      kicker: "Elige tu rol",
      blogger: "Blogger",
      admin: "Admin",
      super: "Super Admin",
      mail: "Email",
      identifier: "Nombre del avatar (o email)",
      pass: "Contraseña",
      remember: "Recuérdame",
      cta: "Entrar",
      forgot: "¿Olvidaste tu contraseña?",
      loading: "Abriendo...",
      handwritten: "bienvenida",
      missingProfile: "Tu login existe, pero no encontramos tu perfil.",
      leftAccount: "Esta cuenta de blogger ya no está activa.",
      failed: "No se pudo entrar. Inténtalo otra vez.",
    },
    app: {
      logout: "Cerrar sesión",
      preview: "Solo previsualización — conectar el backend después.",
    },
  },
} as const;

export function useLang(): Lang {
  const params = useParams({ strict: false }) as { lang?: string };
  const loc = useLocation({ strict: false });
  const search = (loc.search ?? {}) as { uiLang?: string };

  if (params.lang === "es") return "es";
  if (params.lang === "en") return "en";
  if (search.uiLang === "es") return "es";
  return "en";
}

export function useT() {
  const lang = useLang();
  return { t: dict[lang], lang };
}
