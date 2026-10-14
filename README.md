# esp32_gp_biogas_photos_new

Six ESP32-S3 camera boards photograph six biogas digestion experiments (barrier solution
displaced in a graduated cylinder) and upload the photos to Google Drive. Each board wakes from
deep sleep on a timer, takes a photo, uploads it, and sleeps again.

Built on [gsampallo/esp32cam-gdrive](https://github.com/gsampallo/esp32cam-gdrive).
Carries over everything from [mjmereu/esp32cam-gdrive](https://github.com/mjmereu/esp32cam-gdrive).

## How it works

- **One Apps Script deployment** and one script ID shared by all boards.
- Each board has its own `DEVICE_ID` (set once in `secrets.h`) and sends it with every photo.
- A **Google Sheet** has a `Config` tab with one row per board: `device | folder_name | enabled`.
  The script looks up the board's current `folder_name` and saves the photo there.
- Folders are **never created by the script**. You create each sample's folders in Drive yourself,
  then paste the exact names into `Config`. A name that matches no folder sends photos to an
  `Unsorted` folder (and says so in the `Log` tab), so no photo is lost and a typo can't create
  a stray folder.
- `enabled` is a checkbox. Unchecked = the board still uploads, but the script discards the photo
  (paused). Blank counts as enabled.
- A `Log` tab records every upload: time, device, folder, status, file link.
- File names are `<device>_<yyyyMMdd_HHmmss>.jpg` (time zone set in `Code.gs`).

## One-time setup

1. **Arduino IDE board support**: File > Preferences > *Additional boards manager URLs*, add
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`, then install
   **esp32 by Espressif Systems** in the Boards Manager.
2. **Sheet + script**: create a new Google Sheet, then Extensions > Apps Script. Paste in
   `apps_script/Code.gs`, set `TIMEZONE` at the top, and run `setup()` once (authorize it). This
   creates the `Config` and `Log` tabs with rows `cam_1` to `cam_6`.
3. **Deploy**: Deploy > New deployment > Web app, *Execute as: Me*, *Who has access: Anyone*.
   Copy the ID between `/macros/s/` and `/exec`. After later code changes, use
   Deploy > Manage deployments > edit > *New version* (the ID stays the same).
4. **Per board**: in `biogas_cam/`, copy `secrets.h.example` to `secrets.h`. Fill in the WiFi,
   the script ID, and a **unique `DEVICE_ID`** (`cam_1`..`cam_6`, matching a `Config` row).
5. **Arduino IDE > Tools** (ESP32-S3 two-USB-C board, OV3660, N16R8 module):
   Board **ESP32S3 Dev Module**, **PSRAM: OPI PSRAM**, **USB CDC On Boot: Disabled**, Flash Size
   to match (commonly 16MB). Plug into the port labelled **TTL**, not OTG. If the upload won't
   start: hold **BOOT**, tap **RST**, release **BOOT**.
6. Open `biogas_cam/biogas_cam.ino`, flash, and open the Serial Monitor at 115200.

## Starting a new sample

1. In Drive, create the six folders for the sample (any names you like).
2. In the Sheet's `Config` tab, paste each folder's exact name next to its board.
3. Done. No re-flashing, no redeploying. Use the `enabled` checkbox to pause a board
   (for example while you reset an experiment). To turn a board fully off, use an inline USB
   power switch.

## Settings in `biogas_cam.ino`

| Setting | Meaning |
|---|---|
| `UPLOAD_INTERVAL_SEC` | Time between photos (default 1800 = 30 min). |
| `NATIVE_JPEG` | `1` (default): the sensor's own JPEG at `NATIVE_FRAME_SIZE` (2048x1536), cleanest picture, **no timestamp or rotation on the photo** (time is in the file name). `0`: raw RGB565 path that draws the timestamp and can rotate. |
| `NATIVE_FRAME_SIZE`, `NATIVE_JPEG_QUALITY` | Native path size, and quality (0-63, **lower = better/bigger**). If capture or upload fails, step down: UXGA, then SXGA. |
| `FRAME_SIZE`, `JPEG_QUALITY` | Stamped path only. XGA (1024x768) works; UXGA fails to capture. Quality 100 truncates the file, so stay at 90 or below. |
| `STAMP_SWAP_BYTES` | Stamped path only. `0` gave correct colors on this board. |
| `ROTATE_PORTRAIT`, `ROTATE_CLOCKWISE` | Stamped path only. Portrait rotation; flip direction if upside down. |
| `TIMEZONE` | POSIX time zone for the stamped path (default US Eastern). |

## Troubleshooting

Serial Monitor lines to look for: `PSRAM found`, `Camera OK`, a WiFi IP address, then `Upload OK`.

| Symptom | Likely cause |
|---|---|
| `No PSRAM` or `frame buffer malloc failed` | Set Tools > PSRAM to **OPI PSRAM** and re-flash. |
| `Camera capture failed` | Frame size too large; step it down. |
| `Disconnect reason: 201` | Network name not found: wrong SSID or a 5 GHz-only network (ESP32 is 2.4 GHz only). The scan list at boot shows what the board sees. |
| `Disconnect reason: 15` | Wrong WiFi password. |
| `Connection failed` / `No response` | Network or Google problem; try a smaller `NATIVE_FRAME_SIZE`. |
| Photos in `Unsorted` | `Log` tab says why: unknown device, empty folder name, or folder name not found. |
| Blurry photos | The OV3660 is fixed-focus. Twist the lens barrel (grip with a rubber band) with the camera at its real distance, and add light. For quick feedback while focusing, temporarily use `UPLOAD_INTERVAL_SEC 20` and a small `NATIVE_FRAME_SIZE`. |

## School WiFi

The ESP32 only does 2.4 GHz. An open guest network works (`#define WIFI_PASSWORD ""`).
Enterprise (username/password) networks and MAC-registration portals will not work with a plain
SSID/password. A phone hotspot on 2.4 GHz is a good fallback.
