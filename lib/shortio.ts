type ShortIoResponse = {
  originalURL?: string;
  path?: string | null;
  idString?: string;
  id?: string;
  shortURL?: string;
  secureShortURL?: string;
};

function config() {
  const apiKey = process.env.SHORTIO_API_KEY?.trim();
  const domain = (process.env.SHORTIO_DOMAIN || "ulasantoko.space").trim();

  if (!apiKey) throw new Error("SHORTIO_API_KEY belum dikonfigurasi di Vercel.");
  if (!domain) throw new Error("SHORTIO_DOMAIN belum dikonfigurasi.");

  return { apiKey, domain };
}

function headers(apiKey: string) {
  return {
    Authorization: apiKey,
    accept: "application/json",
    "content-type": "application/json",
  };
}

export function v2PublicShortUrl(cardCode: string) {
  const domain = (process.env.SHORTIO_DOMAIN || "ulasantoko.space").trim();
  return "https://" + domain + "/" + encodeURIComponent(cardCode);
}

export function v2DestinationUrl(cardCode: string) {
  const origin = (
    process.env.V2_APP_ORIGIN ||
    process.env.NEXT_PUBLIC_V2_APP_ORIGIN ||
    "https://ulasantoko-review-card.vercel.app"
  ).replace(/\/$/, "");

  return origin + "/" + encodeURIComponent(cardCode);
}

export async function getV2ShortLink(cardCode: string) {
  const code = String(cardCode).trim().toUpperCase();
  if (!/^LP\d{5}$/.test(code)) throw new Error("Kode V2 tidak valid untuk Short.io.");

  const { apiKey, domain } = config();
  return readLink(domain, code, apiKey);
}

async function readLink(domain: string, path: string, apiKey: string) {
  const url =
    "https://api.short.io/links/expand?domain=" +
    encodeURIComponent(domain) +
    "&path=" +
    encodeURIComponent(path);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: apiKey,
      accept: "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    const message = await response.text();
    throw new Error("Short.io gagal membaca link: " + message.slice(0, 300));
  }

  return (await response.json()) as ShortIoResponse;
}

async function createLink(
  domain: string,
  path: string,
  destination: string,
  title: string,
  apiKey: string
) {
  const response = await fetch("https://api.short.io/links", {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({
      originalURL: destination,
      domain,
      path,
      title,
      redirectType: 302,
      allowDuplicates: false,
    }),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as ShortIoResponse & {
    success?: boolean;
    duplicate?: boolean;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(
      "Short.io gagal membuat link (" +
        response.status +
        "): " +
        (data.message || JSON.stringify(data)).slice(0, 300)
    );
  }

  return data;
}

export async function ensureV2ShortLink(cardCode: string, title?: string) {
  const code = String(cardCode).trim().toUpperCase();
  if (!/^LP\d{5}$/.test(code)) {
    throw new Error("Kode V2 tidak valid untuk Short.io.");
  }

  const { apiKey, domain } = config();
  const destination = v2DestinationUrl(code);
  const existing = await readLink(domain, code, apiKey);

  if (existing) {
    if (existing.originalURL === destination) {
      return {
        shortURL: existing.shortURL || v2PublicShortUrl(code),
        originalURL: existing.originalURL,
        idString: existing.idString || existing.id || null,
        existing: true,
      };
    }

    const linkId = existing.idString || existing.id;
    if (!linkId) {
      throw new Error("Link Short.io sudah ada tetapi ID tidak tersedia.");
    }

    const response = await fetch(
      "https://api.short.io/links/" + encodeURIComponent(linkId),
      {
        method: "POST",
        headers: headers(apiKey),
        body: JSON.stringify({
          originalURL: destination,
          title: title || code,
        }),
        cache: "no-store",
      }
    );

    const data = (await response.json().catch(() => ({}))) as ShortIoResponse & {
      message?: string;
    };

    if (!response.ok) {
      throw new Error(
        "Short.io gagal memperbarui link (" +
          response.status +
          "): " +
          (data.message || JSON.stringify(data)).slice(0, 300)
      );
    }

    return {
      shortURL: data.shortURL || existing.shortURL || v2PublicShortUrl(code),
      originalURL: destination,
      idString: data.idString || data.id || linkId,
      existing: true,
    };
  }

  const created = await createLink(
    domain,
    code,
    destination,
    title || code,
    apiKey
  );

  return {
    shortURL: created.shortURL || v2PublicShortUrl(code),
    originalURL: destination,
    idString: created.idString || created.id || null,
    existing: false,
  };
}
