import type { Muscle } from "./training";

const escapeXml = (value: string) => value.replace(/[<>&"']/g, character => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[character]!));

/** Stylized anatomy, with muscle regions addressed independently of the photo. */
export function muscleFigureSvg(worked: readonly Muscle[], view: "front" | "back"): string {
  const active = new Set(worked);
  const fill = (muscle?: Muscle) => muscle && active.has(muscle) ? "#ef4444" : "#a9b2bc";
  const path = (d: string, muscle?: Muscle, extra = "") => `<path d="${d}" fill="${fill(muscle)}" stroke="#303946" stroke-width="1.35" stroke-linejoin="round" ${extra}/>`;
  const both = (d: string, muscle?: Muscle) => `${path(d, muscle)}${path(d, muscle, 'transform="scale(-1 1)"')}`;
  const body = `<ellipse cx="0" cy="22" rx="16" ry="21" fill="#c6cdd4" stroke="#303946" stroke-width="1.3"/>
    ${path("M-10 39 L-10 50 -20 57 0 67 20 57 10 50 10 39 Z")}
    ${both("M42 72 C55 78 56 95 58 112 L65 144 62 169 52 178 42 160 42 140 33 106 Z")}
    ${both("M62 164 L69 179 70 194 66 199 63 188 61 200 57 200 56 184 52 177 Z")}
    ${path("M-38 64 C-42 82 -36 110 -29 128 L-24 158 -29 181 -34 207 -26 247 -27 284 -22 325 -5 325 -3 278 0 236 3 278 5 325 22 325 27 284 26 247 34 207 29 181 24 158 29 128 C36 110 42 82 38 64 L17 54 0 61 -17 54 Z")}
    ${both("M5 320 L21 320 24 335 18 339 3 339 2 333 Z")}`;
  const armsFront = `${both("M40 76 C49 81 52 95 52 109 L44 125 37 114 33 95 Z", "biceps")}
    ${both("M51 112 L57 125 61 146 57 169 51 173 45 155 44 136 Z", "forearms")}
    ${both("M52 85 L58 109 55 124 51 112 49 95 Z", "triceps")}`;
  const front = `${both("M9 55 L24 57 C34 55 45 62 46 75 L38 84 28 75 14 68 Z", "frontDelts")}
    ${both("M28 57 C42 55 48 63 48 78 L43 89 38 79 36 66 Z", "sideDelts")}
    ${both("M2 65 C14 62 28 68 34 78 L32 90 17 98 2 94 Z", "chest")}
    ${armsFront}
    ${both("M31 94 L25 104 25 125 21 145 14 154 13 122 16 104 Z", "obliques")}
    ${both("M2 99 L13 101 14 113 2 114 Z", "abs")}
    ${both("M2 117 L14 116 13 130 2 131 Z", "abs")}
    ${both("M2 134 L12 133 12 146 2 151 Z", "abs")}
    ${both("M2 154 L12 149 15 159 8 175 2 174 Z", "abs")}
    ${both("M20 159 L28 176 30 199 25 223 16 239 9 226 8 200 11 178 Z", "quads")}
    ${both("M8 175 L9 200 7 224 3 238 1 222 2 197 Z", "quads")}
    ${both("M27 185 L32 208 27 231 21 242 20 226 25 211 Z", "quads")}
    ${both("M10 246 L22 245 26 262 22 287 17 305 12 307 9 281 Z", "calves")}
    ${both("M9 246 L13 257 11 281 8 314 6 319 5 285 Z")}`;
  const back = `${both("M3 48 L14 54 32 59 22 75 2 89 Z", "upperBack")}
    ${both("M29 59 C40 56 47 64 47 77 L38 88 28 80 23 71 Z", "rearDelts")}
    ${both("M38 59 C47 61 50 68 49 80 L44 90 39 82 42 70 Z", "sideDelts")}
    ${both("M3 91 L20 76 31 83 29 97 14 108 3 105 Z", "upperBack")}
    ${both("M30 90 L32 105 26 125 15 145 6 149 11 121 7 110 Z", "lats")}
    ${both("M2 107 L9 114 6 142 10 157 2 163 Z", "lowerBack")}
    ${both("M26 124 L22 148 27 164 14 165 12 147 Z", "obliques")}
    ${both("M40 86 L48 82 53 100 51 116 44 130 37 117 35 102 Z", "triceps")}
    ${both("M44 132 L52 117 58 132 61 148 56 173 49 170 44 153 Z", "forearms")}
    ${both("M2 164 C10 156 22 159 27 170 L29 190 C22 201 11 204 2 195 Z", "glutes")}
    ${both("M4 200 L15 204 18 227 13 246 6 242 3 222 Z", "hamstrings")}
    ${both("M18 203 L29 195 30 216 24 244 17 249 19 227 Z", "hamstrings")}
    ${both("M8 254 C13 246 17 249 17 263 L16 279 10 292 6 283 5 269 Z", "calves")}
    ${both("M18 252 C24 249 27 260 25 276 L19 295 16 279 18 265 Z", "calves")}
    ${both("M12 293 L18 295 17 322 9 322 Z")}`;
  return `<g>${body}${view === "front" ? front : back}<path d="M0 63V173 M-4 233L0 240 4 233" fill="none" stroke="#303946" stroke-width="1.1" opacity=".75"/></g>`;
}

/** Self-contained vector card: no remote assets, fonts, scripts, or photo analysis. */
export function sessionOverlaySvg(muscles: readonly Muscle[], routine: string, date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  const label = Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase() : date;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="286" viewBox="0 0 640 286">
    <rect x="1" y="1" width="638" height="284" rx="20" fill="#11151b" fill-opacity=".88" stroke="#cdd4dd" stroke-opacity=".3"/>
    <g transform="translate(80 17) scale(.70)">${muscleFigureSvg(muscles, "front")}</g>
    <g transform="translate(204 17) scale(.70)">${muscleFigureSvg(muscles, "back")}</g>
    <g font-family="Arial, sans-serif" fill="#f5f7fa">
      <text x="80" y="268" text-anchor="middle" font-size="11" letter-spacing="2" fill="#c8d0da">FRONT</text>
      <text x="204" y="268" text-anchor="middle" font-size="11" letter-spacing="2" fill="#c8d0da">BACK</text>
      <text x="300" y="88" font-size="15" font-weight="700" letter-spacing="3" fill="#ff8a4c">REPBOOK</text>
      <text x="297" y="146" font-size="49" font-weight="800">${escapeXml(routine.toUpperCase())}</text>
      <text x="300" y="182" font-size="24" font-weight="600">${escapeXml(label)}</text>
      <circle cx="306" cy="221" r="5" fill="#ef4444"/>
      <text x="321" y="226" font-size="14" fill="#d4dbe3">MUSCLES TRAINED</text>
    </g>
  </svg>`;
}
