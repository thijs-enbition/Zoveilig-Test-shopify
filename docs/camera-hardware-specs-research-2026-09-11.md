# Camera-hardware — real product specs research (2026-09-11)

**PHASE 1 of 2 — research only. No code was changed by this document.** Per the task, Phase 2
(building the hover/tap spec UI in `sections/camera-hardware.liquid`) does not start until
Thijs has reviewed this doc and confirmed the specs look right.

**Why this exists:** the camera-hardware page's `HW` configurator array
(`sections/camera-hardware.liquid:74-97`) lists 22 products by internal SKU and a customer-facing
title, but carries no real specs. To show specs on hover/tap, we first need to know what each
product actually *is* — many of our internal SKUs (`CAM-724`, `VDB-750`, `CL001`, …) don't state
a manufacturer or model number, and a few of our titles are placeholder-looking
(`4MP_WIFI_MICKEY_MOUSE`). This file is a per-product research pass — one independent web-research
subagent per product — to identify the real manufacturer/model where possible and pull sourced
specs relevant to that product type.

**Method:** for each product, search for an official manufacturer datasheet first (Climax
Technology for `CL`/`C00H`-prefixed SKUs, Alarm.com/ADC for camera/doorbell/NVR SKUs), falling
back to a reputable distributor listing only when no official source turned up. Every value below
carries its source URL. Anything not confidently sourced is written as **niet gevonden —
handmatig navragen** rather than estimated — this happens a lot below, by design, and is not a
research shortfall.

**Confidence key:** *high* = official manufacturer datasheet, model number match is solid.
*medium* = official/manufacturer-adjacent source found, but the exact SKU→model mapping is
inferred (product family has multiple similar variants) rather than confirmed against our own
purchasing records. *low* = a plausible candidate exists but the match is weak. *unidentified* =
no model could be pinned down at all; do not use the specs below (if any) as real.

## Summary

| SKU | Current title | Identified as | Confidence |
|---|---|---|---|
| CAM-BINNEN | Binnencamera met SD kaart | not identified (ADC-V515 given only as a non-binding reference) | low |
| CAM-724 | Buitencamera wifi 724 | Alarm.com ADC-V724 | high |
| CAM-730 | Buitencamera wifi 730 | Alarm.com ADC-V730 | high |
| CAM-727 | Binnen/Buitencamera bedraad 727 | Alarm.com ADC-VC727P | high |
| CAM-DOME | Dome camera met SD kaart | Alarm.com ADC-VC827P (candidate) | medium |
| CAM-FLOOD | Wifi floodlight camera (ADC-V7294) | **could not identify — "ADC-V7294" is not a real model number** | unidentified |
| NVR-STREAM | Streamrecorder (NVR) | Alarm.com ADC-SVR210 (best-fit guess) | low–medium |
| VDB-750 | Video deurbel bedraad VDB 750 | Alarm.com ADC-VDB750 | high |
| VDB-755 | Video deurbel bedraad VDB 755 + chime | Alarm.com ADC-VDB755P | medium (see power/chime flag) |
| VDB-780 | Video deurbel draadloos VDB780B + chime | Alarm.com ADC-VDB780B + ADC-W115C chime | high |
| CL001 | (Koop) Magneetcontact (DC-23) | Climax DC-23 family (exact RF variant unconfirmed) | medium |
| ADC-MM | 4MP_WIFI_MICKEY_MOUSE | **could not identify — not a real product name** | unidentified |
| C00H01 | (Koop) huisdier fotopir (bewegingsmelder) | Climax VST-862P-F1 (candidate) | medium |
| C00H02 | (Koop) Huisdier PIR (bewegingsmelder) | Climax IR-31 (candidate) | medium |
| CL002 | (Koop) PIR Bewegingsdetector | Climax IR-9/IR-9SL family (candidate) | low |
| CL003A | (Koop) Foto bewegingsdetector 868 | Climax VST-862P-F1 **or** VST-892HD (two candidates, unresolved) | medium |
| CL004 | (Koop) Afstandsbediening | Climax RC-16 (candidate) | medium |
| CL005 | (Koop) Rookmelder | **could not identify — too many plausible Climax SD-x models** | unidentified |
| CL006A | (Koop) Binnensirene | Climax SRAC-23(F1) (candidate — dB conflict, see flag) | medium |
| CL007 | (Koop) Glasbreukmelder | Climax ACGS-23ZW (or ZigBee sibling ACGS-23ZBS, unconfirmed) | medium |
| CL2212 | (Koop) Magneetcontact met shocksensor | Climax DCSV-29 (candidate) | medium |
| ROL | (Koop) SA-220 Roldeur behuizing | **Jablotron SA-220** — different vendor than assumed, see flag | medium |

## Products with no reliable specs at all

**CAM-FLOOD, ADC-MM, and CL005** — no model could be confidently identified for any of these
three; do not display any spec content for them until Thijs/Alex supply the real model number.
(CAM-BINNEN and NVR-STREAM came back low/low-medium confidence too, but with a candidate model
provided for reference — see their sections below for why those candidates should **not** be
treated as confirmed either.)

---

## CAM-BINNEN — Binnencamera met SD kaart

**Identified as:** could not confidently identify a single exact model. This SKU carries no
embedded model number (unlike CAM-FLOOD's "ADC-V7294"), and Alarm.com/ADC currently sells several
similar indoor Wi-Fi cameras (ADC-V515, ADC-V523, ADC-V622, ADC-V723, ADC-V516), several of which
also support local SD-card recording — "has an SD card" doesn't distinguish between them.
**Confidence:** low (reference model only, not a confirmed match)

| Spec | Value | Source |
|---|---|---|
| Resolution | 1920×1080 (1080p), 1/3" 2.12MP sensor | [ADC-V515 official Alarm.com data sheet](https://answers.alarm.com/Partner/Installation_and_Troubleshooting/Video_Devices/1080p_Indoor_Wi-Fi_Camera_(ADC-V515)/1080p_Indoor_Wi-Fi_Camera_(ADC-V515)_-_Data_Sheet) |
| Field of view | 110° (3.19mm lens, F2.2) | same |
| Night vision range | Up to ~15 ft (4.6m) IR, 0 lux with IR | same |
| Local storage | microSD, 32GB–512GB, card not included | [Alarm Grid — SD card install on ADC-V515](https://www.alarmgrid.com/faq/how-do-i-install-the-sd-card-in-an-adc-v515) |
| Connectivity | Wi-Fi only, 802.11 b/g/n, 2.4GHz | official data sheet |
| Power source | 12V–1A DC adapter (included) | official data sheet |

**Notes/flags:** the table above is only a plausible reference (ADC-V515), not a confirmed match.
Needs the actual purchase invoice, packaging, or type plate on the physical unit to confirm which
ADC indoor camera CAM-BINNEN really is.

## CAM-724 — Buitencamera wifi 724

**Identified as:** Alarm.com ADC-V724 (1080p Outdoor Wi-Fi Camera, discontinued, replaced by
near-identical ADC-V724X)
**Confidence:** high

| Spec | Value | Source |
|---|---|---|
| Resolution | 1/3", 2MP, 1920×1080, H.264 | [Official ADC-V724 data sheet](https://www.sdilink.com/Specsheet/adc-v724.pdf) |
| Field of view | 117° horizontal, 65° vertical, 140° diagonal | same |
| Night vision range | ~49 ft (15m) IR; 0.5 lux with IR | same |
| Local storage | microSD (not included), up to 1.5TB on firmware 0.8.6.060+ | [Alarm.com KB — Onboard Recording (SD card)](https://answers.alarm.com/Partner/Installation_and_Troubleshooting/Video_Devices/General_Video_Information/Onboard_Recording_(SD_card)_with_Smart_View_for_video_devices) |
| Connectivity | Wi-Fi 802.11 b/g/n/ac, 2.4 & 5GHz | official data sheet |
| Power source | 12V–1A DC adapter (included) | official data sheet |
| Outdoor/weather rating | IP66 | [Official ADC-V724 Product Summary PDF](https://poweredbyalarm.com/eventresources/wp-content/uploads/sites/33/2022/08/ProductSummary_724_v2.pdf) |

**Notes/flags:** ADC-V724 is discontinued, replaced by ADC-V724X (functionally near-identical per
available listings). Confirm with Thijs/Alex which exact hardware revision Zo Veilig actually
stocks.

## CAM-730 — Buitencamera wifi 730

**Identified as:** Alarm.com ADC-V730 (4MP Outdoor Wi-Fi Spotlight Camera)
**Confidence:** high

| Spec | Value | Source |
|---|---|---|
| Resolution | 4MP, max 2688×1520, 1/3" HDR sensor | [Alarm.com official KB data sheet](https://answers.alarm.com/Partner/Installation_and_Troubleshooting/Video_Devices/4MP_Outdoor_Spotlight_Camera_(ADC-V730_VC730P)/4MP_Outdoor_Wi-Fi_Spotlight_Camera_(ADC-V730)_-_Data_Sheet) |
| Field of view | 129° horizontal, 68° vertical, 153° diagonal | same; corroborated by [Alarm.com press release](https://investors.alarm.com/news-releases/press-release-details/2025/Alarm-com-Introduces-AI-Powered-ADC-V730-Wi-Fi-Spotlight-Camera-with-Proactive-Deterrence/default.aspx) |
| Night vision | IR + color spotlight mode; IR range ~49 ft (15m) | official KB data sheet |
| Local storage | microSD, up to 1TB | [Alarm.com press release](https://investors.alarm.com/news-releases/press-release-details/2025/Alarm-com-Introduces-AI-Powered-ADC-V730-Wi-Fi-Spotlight-Camera-with-Proactive-Deterrence/default.aspx) (corroborated, lower confidence, by [Nelly's Security](https://nellyssecurity.com/products/adc-v730)) |
| Connectivity | Dual-band Wi-Fi 6, 802.11b/g/n/ac/ax, 2.4 & 5GHz | official KB data sheet |
| Power source | 12V, 1.5A DC adapter (included), 10ft cable | official KB data sheet |
| Outdoor/weather rating | IP66; -40°F to 122°F (-40°C to 50°C) | official KB data sheet |

**Notes/flags:** this is the model that SKU 730 from the earlier product-addition batch
(`koop-730-buitencamera-wifi`) was excluded as a duplicate of — see
[`docs/camera-hardware-additions-2026-09-11.md`](camera-hardware-additions-2026-09-11.md). One
distributor page showed a stale ~117° FOV figure that conflicts with both the official data sheet
and press release (both agree on 129°/68°) — treat 129°/68° as correct.

## CAM-727 — Binnen/Buitencamera bedraad 727

**Identified as:** Alarm.com ADC-VC727P ("1080p Mini-Bullet Camera", Pro Series) — PoE-wired
indoor/outdoor bullet camera
**Confidence:** high

| Spec | Value | Source |
|---|---|---|
| Resolution | 1920×1080 (also 1280×720, 640×360) | [ADC-VC727P Data Sheet (Alarm.com KB, mirrored)](https://24incontrol.com/wp-content/uploads/2023/05/ADC-VC727P-Data-Sheet.pdf) |
| Field of view | 117° | same |
| Night vision | Up to 49 ft (15m) IR, 0 lux with IR | same |
| Local storage | microSD, up to 512GB | [Onboard Recording (SD card) — Alarm.com KB, mirrored](https://24incontrol.com/wp-content/uploads/2023/01/Onboard-Recording-SD-card-information.pdf) |
| Connectivity/wiring | PoE (802.3af) or 10/100 Ethernet — wired, not Wi-Fi | ADC-VC727P data sheet |
| Power source | 12VDC ±10% (adapter separate) or PoE 802.3af | same |
| Outdoor/weather rating | IP66; -30°C to 50°C | same |

**Notes/flags:** real model tail is "VC727P," not "V727" — digits still match. This is a
"commercial Pro Series" model with business-analytics features (people counting, etc.) that
likely shouldn't appear in consumer-facing copy for this residential listing. All Alarm.com
cameras require an active Alarm.com service plan.

## CAM-DOME — Dome camera met SD kaart

**Identified as:** Alarm.com ADC-VC827P ("1080p Indoor/Outdoor Dome Camera") — the dome model in
Alarm.com's line built around onboard microSD recording (its close sibling ADC-VC826 has no SD
slot at all, PoE/cloud-only, so was ruled out).
**Confidence:** medium — SKU has no numeric hint, so this is a well-reasoned candidate, not a
confirmed match.

| Spec | Value | Source |
|---|---|---|
| Resolution | 1920×1080, 1280×720, 640×360; H.264 | [Alarm.com official KB — ADC-VC827P Data Sheet](https://answers.alarm.com/Partner/Installation_and_Troubleshooting/Video_Devices/1080p_Indoor-Outdoor_Dome_Camera_(ADC-VC827P)/1080p_Indoor%2F%2FOutdoor_Dome_Camera_(ADC-VC827P)_-_Data_Sheet) |
| Field of view | 2.8mm lens, F1.6, 111° | same |
| Night vision | Up to ~95 ft (30m) IR, 0 lux with IR | same |
| Local storage | microSD — **conflicting max size**: official KB says 32GB–1.5TB; a distributor copy of the same sheet (Alarm Grid) says max 256GB | official: as above; conflict source: [Alarm Grid — ADC-VC827P Data Sheet](https://www.alarmgrid.com/documents/alarm-com-adc-vc827p-1080p-indoor-outdoor-dome-camera-data-sheet) |
| Connectivity | 10/100 RJ-45, PoE 802.3af Type 1 — no Wi-Fi | official KB data sheet |
| Power source | 12VDC ±10% or PoE 802.3af Type 1; 5W typical/10W peak | same |
| Indoor/outdoor rating | IP66, IK9 | same |

**Notes/flags:** two sources disagree on max SD card size (likely a firmware/hardware revision
difference) — flagged rather than picked. Confirm with the supplier that the actual stocked unit
is the SD-capable variant (VC827P) and not the SD-less sibling (VC826).

## CAM-FLOOD — Wifi floodlight camera (ADC-V7294)

**Identified as:** could not confidently identify — **"ADC-V7294" is not a real Alarm.com/ADC
model number.** Checked across multiple official and distributor sources; zero hits anywhere.
**Confidence:** unidentified

| Spec | Value | Source |
|---|---|---|
| All fields (resolution, FOV, night vision, floodlight brightness, storage, connectivity, power, IP rating) | niet gevonden — handmatig navragen | — |

**Notes/flags:** the closest genuine Alarm.com floodlight camera family is **ADC-V729 /
ADC-V729AC / ADC-VC729P** (4MP outdoor Wi-Fi floodlight camera with official data sheets, e.g.
[Alarm Grid](https://www.alarmgrid.com/documents/alarm-com-adc-v729-series-floodlight-camera-dated-10-2023)),
but that's a different SKU string and should not be assumed to be the same product. **The model
number in the product title itself appears to be wrong and needs correcting at the source**
(supplier invoice or physical unit) before any spec research can proceed for this product.

## NVR-STREAM — Streamrecorder (NVR)

**Identified as:** likely Alarm.com Stream Video Recorder family; best single-model guess is
**ADC-SVR210** (8-channel), but Alarm.com sells several SVR/CSVR variants at different channel
counts (SVR100, SVR122, SVR210, CSVR126, CSVR2008P, CSVR2016P, CSVR2108P) and the SKU carries no
disambiguating digits.
**Confidence:** low–medium (family confirmed, exact model unconfirmed)

| Spec | Value | Source |
|---|---|---|
| Camera channels | Up to 8 (70 Mbps total) — ADC-SVR210 | [ADC-SVR210 Data Sheet](https://answers.alarm.com/Partner/Installation_and_Troubleshooting/Video_Devices/Stream_Video_Recorder_(SVR)/Stream_Video_Recorder_(ADC-SVR210)/Stream_Video_Recorder_(ADC-SVR210)_-_Data_Sheet) |
| Storage capacity/type | 1x 3.5" SATA HDD, 1–2TB | same |
| Max video resolution | 4MP HDR | same |
| Connectivity | 2x GbE LAN (RJ45); not itself PoE | same |
| Cloud/streaming support | Integrated with Alarm.com video service; app/web viewing | same |

**Notes/flags:** a larger commercial candidate was also found for comparison — ADC-CSVR126
(16-channel, up to 16TB, [Surety forum listing](https://support.suretyhome.com/t/alarm-com-commercial-stream-video-recorder-adc-csvr126/29025),
distributor source, lower confidence) — but given the €500 price and residential-sounding title,
ADC-SVR210 is the more plausible match. Confirm the real SKU against Alarm.com's dealer portal or
the purchase invoice before publishing.

## VDB-750 — Video deurbel bedraad VDB 750

**Identified as:** Alarm.com ADC-VDB750 (wired video doorbell)
**Confidence:** high — official Alarm.com PDF data sheet (doc code 221104)

| Spec | Value | Source |
|---|---|---|
| Resolution | Max 1440×1440 (2MP, 1/2.4" HDR sensor) | [ADC-VDB750 Data Sheet PDF](https://www.alarmax.com/customer/docs/skudocs/adc-vdb750-alarm-dot-com-video-doorbell-camera-data-sheet.pdf) |
| Field of view | 165° horizontal, 145° vertical | same |
| Two-way audio | Yes, full-duplex | same |
| Night vision | IR, 0 lux with IR; range up to 15ft (5m) | same |
| Power (wired) | AC 16–24VAC 10–40VA (16VAC/10VA recommended), or DC 15–24V 6–20W | same |
| Chime compatibility | Alarm.com Smart Chime (ADC-W115C); mechanical chime needs a 22Ω 5W flameproof resistor | same; resistor detail also on [Alarm.com KB page](https://answers.alarm.com/Partner/Installation_and_Troubleshooting/Video_Devices/Alarm.com_Video_Doorbell_(ADC-VDB750)/Alarm.com_Video_Doorbell_(ADC-VDB750)_-_Data_Sheet) |
| Weather/IP rating | IP65; -58°F to 122°F (-50°C to 50°C); <95% RH non-condensing | ADC-VDB750 Data Sheet PDF |

**Notes/flags:** a **digital** doorbell chime (not a plain mechanical bell) additionally needs the
separate ADC-VDBA-PM-750 power module — this detail came from search-result summaries, not the
datasheet PDF itself, so verify against the installation guide before using it in copy.

## VDB-755 — Video deurbel bedraad VDB 755 + chime

**Identified as:** Alarm.com ADC-VDB755P ("Alarm.com PoE Video Door Station", Pro Series)
**Confidence:** medium (model identity is high-confidence; capped at medium because of the
power/chime mismatch below)

| Spec | Value | Source |
|---|---|---|
| Resolution | 2MP, max 1440×1440 (H.264) | [Alarm.com KB — ADC-VDB755P Data Sheet](https://answers.alarm.com/Partner/Installation_and_Troubleshooting/Video_Devices/Alarm.com_PoE_Video_Door_Station_(ADC-VDB755P)/Alarm.com_PoE_Video_Door_Station_(ADC-VDB755P)_-_Data_Sheet) |
| Field of view | 150° horizontal, 150° vertical | same |
| Two-way audio | Yes, full-duplex | same |
| Night vision | IR up to 15ft (5m); 0 lux with IR | same |
| Power | **PoE 802.3af via RJ-45 — not a 16–24VAC transformer** | same; [AlarMax official PDF](https://www.alarmax.com/customer/docs/skudocs/adc-vdb755p-alarm-dot-com-pro-series-video-doorbell-station-data-sheet.pdf) |
| Weather/IP rating | IP66 | [Nelly's Security](https://nellyssecurity.com/products/adc-vdb755); AlarMax PDF |
| Included chime | **Not bundled by the manufacturer by default** — reuses existing wired chime, or the separate Alarm.com Smart Chime ADC-W115C (1.5W, 77dB, 100–120VAC US-market rated) | [ADC-W115C Data Sheet](https://answers.alarm.com/Partner/Installation_and_Troubleshooting/Access_Points/Alarm.com_Smart_Chime_(ADC-W115C)/Alarm.com_Smart_Chime_(ADC-W115C)_-_Data_Sheet) |

**Notes/flags — important for copy/installation instructions:**
- Our title says "bedraad" (wired), which is technically correct, but the unit is **PoE-powered**,
  not the traditional 16–24VAC doorbell-transformer wiring "bedraad" usually implies in NL
  security retail — installation needs a PoE injector/switch, a materially different job.
- Since the chime is **not bundled by Alarm.com**, and our title says "+ chime," someone
  (Zo Veilig or its distributor) must be assembling this as a bundle — needs confirmation of
  exactly which chime hardware ships in the box, and whether it's EU/230V-compatible (the
  ADC-W115C's published rating is US-market 100–120VAC).

## VDB-780 — Video deurbel draadloos VDB780B + chime

**Identified as:** Alarm.com Wireless Video Doorbell ADC-VDB780B, paired with Alarm.com Smart
Chime ADC-W115C
**Confidence:** high

| Spec | Value | Source |
|---|---|---|
| Resolution | 1920×1080, 2.12MP Sony IMX323 sensor | [Alarm.com KB — ADC-VDB780B Data Sheet](https://answers.alarm.com/Partner/Installation_and_Troubleshooting/Video_Devices/Alarm.com_Wireless_Video_Doorbell_(ADC-VDB780B)/Alarm.com_Wireless_Video_Doorbell_(ADC-VDB780B)_-_Data_Sheet) |
| Field of view | 160° horizontal, 90° vertical, 175° diagonal | same |
| Two-way audio | Yes; 1W/8Ω speaker, omni-directional mic | same |
| Night vision | IR up to 15ft (5m); 0.5 lux low-light | same |
| Battery | 9540mAh rechargeable, micro-USB charging (~7hrs), ~6 months/charge typical use | same |
| Included chime | Alarm.com Smart Chime ADC-W115C: 1.5W/77dB, adjustable tones, doubles as 2.4GHz Wi-Fi extender | [ADC-W115C Data Sheet](https://answers.alarm.com/Partner/Installation_and_Troubleshooting/Access_Points/Alarm.com_Smart_Chime_(ADC-W115C)/Alarm.com_Smart_Chime_(ADC-W115C)_-_Data_Sheet); pairing corroborated via [GeoArm](https://www.geoarm.com/adc-w115c-alarm-dot-com-smart-chime-and-wifi-access-point.html) |
| Weather/IP rating | IP66; -20°C to 50°C; 20–100% RH non-condensing | ADC-VDB780B Data Sheet |

**Notes/flags:** requires Wi-Fi to a Smart Chime, Smart Gateway (ADC-SG130), or IQ Panel 4 — no
traditional wired chime input, relevant for any copy mentioning "chime" compatibility.

## CL001 — (Koop) Magneetcontact (DC-23)

**Identified as:** Climax Technology DC-23 series wireless magnetic door/window contact
**Confidence:** medium — manufacturer/model confirmed, but DC-23 is a product *family* (multiple
RF-band and protocol variants) and our listing doesn't state which sub-variant.

| Spec | Value | Source |
|---|---|---|
| Max gap/detection distance | 15mm max front gap (installation spec); separately, 28mm lateral misalignment tolerance stated on the product page | [Official manual](https://manuals.plus/climax-technology/dc-23-2w-dc-23-series-contact-wireless-doorwindow-manual); [climax.com.tw/dc23.php](https://www.climax.com.tw/dc23.php) |
| Battery type | CR123, 3V lithium | climax.com.tw/dc23.php; official manual |
| Battery life | 10 years (LOWER CONFIDENCE / DISTRIBUTOR SOURCE, stated for a rebranded variant) | [orbitadigital.com](https://www.orbitadigital.com/en/cctv/alarms/vesta/21533-dc-23-f1brown.html) |
| Wireless frequency | niet gevonden — handmatig navragen (family spans 433/868/869/915MHz variants; a US FCC filing shows 433.82MHz, an EU distributor SKU implies 868/869MHz) | [FCC filing](https://fccid.io/GX9DC23/User-Manual/Users-Manual-3855335); [EU distributor SKU](https://shop.sensio.io/en_GB/shop/350097-climax-dc-23-wireless-door-window-contact-dc-23-r3-f1-869-15580) |
| Wireless range | niet gevonden — handmatig navragen | — |
| Mounting type | Surface mount | official manual |
| Tamper protection | Yes, built-in tamper switch | climax.com.tw/dc23.php; official manual |

**Notes/flags:** DC-23 spans proprietary-RF, Z-Wave, ZigBee, wired-BUS, and cellular variants —
check the physical unit's full part number (e.g. "DC-23-R3-F1 xxx") to pin frequency/range/battery
life exactly.

## ADC-MM — 4MP_WIFI_MICKEY_MOUSE

**Identified as:** could not confidently identify — internal/placeholder SKU, not a real product
name.
**Confidence:** unidentified

| Spec | Value | Source |
|---|---|---|
| All fields | niet gevonden — handmatig navragen | — |

**Notes/flags:** two possibilities were checked. (a) A real ADC 4MP wifi camera mislabeled with an
unrelated internal nickname during import — plausible, since Alarm.com sells several 4MP wifi
cameras (ADC-V730, ADC-V530, ADC-V731B, ADC-V729/V729AC), but none singles out as a clean match to
our €475 price the way ADC-V729/V729AC reportedly does for CAM-FLOOD's price point, so picking one
would be guessing. (b) A literal Mickey-Mouse-shaped novelty/nanny camera — such products exist
but retail for tens of dollars, not €475, arguing against this. **Thijs/Alex need to confirm the
actual underlying product** (original import source, distributor invoice, or Odoo record).

## C00H01 — (Koop) huisdier fotopir (bewegingsmelder)

**Identified as:** Climax VST-862P-F1 "Pet-Immune Camera PIR Sensor" (candidate)
**Confidence:** medium

| Spec | Value | Source |
|---|---|---|
| Pet immunity weight threshold | 27kg (59lb) | [Climax VST-862P-F1 datasheet](https://www.casmarglobal.com/media/akeneo_connector/media_files/D/S/DS_CMX_VST862P_F1_63e5.pdf) |
| Detection range | 10m overall, 7m pet-immune (at 2m install height) | same |
| Detection angle | 90° PIR; 102° camera FOV | same |
| Photo capture | VGA CMOS, 640×480 or 320×240, 1/3/6 images per trigger; warm-white or IR fill light to 5–10m depending on variant | same |
| Battery type | 3x CR123A lithium, or 2x AA alkaline | same |
| Battery life | Lithium 8 years*, alkaline 4 years* (*varies with use) | same |
| Wireless frequency | 433MHz / 868MHz | same |
| Wireless range | 400–900m open space | same |

**Notes/flags:** picked because it's consistent with sibling SKUs on our own page — CL003A
("Foto bewegingsdetector 868," same €125 price) and C00H02 ("Huisdier PIR," no photo, €49) — but
Climax also sells closely related pet-immune camera-PIR siblings (VST-892, VST-852EX, non-F1
VST-862P) with different specs. Confirm the physical unit's model number before publishing.

## C00H02 — (Koop) Huisdier PIR (bewegingsmelder)

**Identified as:** Climax IR-31 (wireless pet-immune PIR, no camera) (candidate)
**Confidence:** medium

| Spec | Value | Source |
|---|---|---|
| Pet immunity weight threshold | Up to 25kg | [sourcesecurity.com](https://www.sourcesecurity.com/climax-technology-ir-31-intruder-detector-technical-details.html); [IR-31 manual](https://manuals.plus/climax/ir-31-pet-immune-pir-motion-sensor-manual) |
| Detection range | 12m (at 2.3–2.5m height) | same |
| Detection angle | 90° | sourcesecurity.com |
| Battery type | 2x AA alkaline (base variant; IR-31SL/SSL use CR123 lithium) | IR-31 manual |
| Battery life | niet gevonden — handmatig navragen | — |
| Wireless frequency | niet gevonden — handmatig navragen | — |
| Wireless range | niet gevonden — handmatig navragen | — |

**Notes/flags:** model inferred purely from "pet-immune PIR, no camera" fitting the family
alongside confirmed sibling C00H01 (VST-862P-F1) — not cross-checked against a purchase order.
Climax's official climax.com.tw page for IR-31 couldn't be reached (TLS error); sources used are
lower-confidence aggregator/manual mirrors. A related model (IR-32) offers 433/868/919MHz — not
carried over here since it's a different model, per the no-guessing rule.

## CL002 — (Koop) PIR Bewegingsdetector

**Identified as:** Climax IR-9 / IR-9SL series, possibly IR-16SL (candidate, unconfirmed)
**Confidence:** low

| Spec | Value | Source |
|---|---|---|
| Detection range | 12m | [Climax Deutschland — IR-9/SL](https://climax.de/product/ir-9sl-series-ir-9-series/) |
| Detection angle | 110° | same |
| Battery type | Pre-installed lithium | same |
| Battery life | 4–5 years | same |
| Wireless frequency | niet gevonden — handmatig navragen | — |
| Wireless range | niet gevonden — handmatig navragen | — |
| Pet immunity | No (base line, unlike Climax's explicit pet-immune models IR-31/32/IRP-29) | Climax Deutschland; corroborated by [SecurityInformed — IR-16SL](https://www.securityinformed.com/climax-technology-ir-16sl-intruder-detector-technical-details.html) (distributor, lower confidence) |

**Notes/flags:** official climax.com.tw pages for IR-9/IR-9SL/IR-16SL 404 or aren't indexed;
specs came from Climax's German subsidiary site, which lists features but not a full spec sheet
(no frequency/range published there). Check the physical unit's housing for the exact model name.

## CL003A — (Koop) Foto bewegingsdetector 868

**Identified as:** Climax VST-862P-F1 **or** VST-892HD — two plausible photo-PIR families, both
offered in 868MHz, unresolved which.
**Confidence:** medium

| Spec | VST-862P-F1 | VST-892HD | Source |
|---|---|---|---|
| Detection range | 10m (7m pet-immune) at 2m height | 12m at 2.3–2.5m height | [VST-862P-F1](https://www.casmarglobal.com/media/akeneo_connector/media_files/D/S/DS_CMX_VST862P_F1_63e5.pdf) / [VST-892HD](https://www.sourcesecurity.com/datasheets/climax-technology-vst-892hd-intruder-detector/co-9291-ga/vst-892hd-product-news-20231024.pdf) |
| Detection angle | 90° horizontal | 90° horizontal | both |
| Photo capture | VGA CMOS, 640×480/320×240 | HD CMOS, 1280×720/640×480/320×240 | both |
| Wireless frequency | 433/868MHz | 433/868MHz | both |
| Wireless range | 400–900m open space | 400–900m open space | both |
| Battery type | 3x CR123A or 2x AA | 3x CR123A or 2x AA | both |
| Battery life | Lithium 8yr, alkaline 4yr | Lithium 4.8yr, alkaline 2.6yr | both |

**Notes/flags:** VST-862(P)-F1 is VGA-only and matches our plain "Foto bewegingsdetector" naming
(no "HD" qualifier); VST-892HD is a newer HD-branded line. Naming favors VST-862(P)-F1 but this is
inference, not confirmation — and the VST-862 datasheet found is specifically the pet-immune "P"
variant, so a non-pet-immune plain VST-862-F1 (if that's the real unit) may have a longer,
unverified range. Confirm against the purchase invoice/packaging before publishing either
candidate's numbers.

## CL004 — (Koop) Afstandsbediening

**Identified as:** Climax RC-16 Remote Controller (candidate)
**Confidence:** medium

| Spec | Value | Source |
|---|---|---|
| Number of buttons | 4 (Arm/Disarm/Home/Panic) | [Climax RC-16 product page](https://www.climax.com.tw/rc-16.php); [official brochure PDF](https://www.climax.com.tw/new/downloads/RC-16_Product%20News_20240508.pdf) |
| Wireless frequency | 433MHz / 868MHz (dual-band) | same |
| Battery type | 3V CR2032 lithium | same |
| Battery life | 8 years (varies with use) | same |
| Wireless range | niet gevonden — handmatig navragen (genuinely not published by Climax anywhere, incl. FCC filing) | — |

**Notes/flags:** Climax also sells adjacent variants (RC-15, RC-16ZBS ZigBee, RC-16-2W two-way,
RC-29ZW Z-Wave) that could equally be "the" product depending on our alarm panel's protocol —
confirm against the purchase invoice/packaging.

## CL005 — (Koop) Rookmelder

**Identified as:** could not confidently identify — Climax sells at least half a dozen distinct
wireless smoke detector models (SD-7, SD-8, SD-9, SD-29, SD-32, SD-8EL-ZW, SD-8EL-ZBS,
Mini-SD-TM-ZBS, SDCO-1 combo) with materially different sensor tech, wireless protocols, and
certifications, and nothing ties SKU CL005 to one of them.
**Confidence:** unidentified

| Spec | Value | Source |
|---|---|---|
| All fields | niet gevonden — handmatig navragen | — |

**Notes/flags:** for reference only, **not attributed to CL005**: the Climax SD-7/SD-8/SD-9 family
(reflective photoelectric, EN54-7 sensitivity certified, built-in test button, 95dB@1m,
-20°C–50°C) — [sourcesecurity.com](https://www.sourcesecurity.com/climax-technology-sd-7-sd-8-sd-9-intruder-detector-technical-details.html);
the newer SD-32 (UL 217 8th ed., cooking-smoke discrimination) —
[manual](https://manuals.plus/climax-technology/sd-32-smoke-detector-manual),
[product page](https://www.climax.com.tw/sd-32_page.php). Pull the actual invoice or check the
physical unit for the exact model before any spec research can proceed here.

## CL006A — (Koop) Binnensirene

**Identified as:** likely Climax SRAC-23(F1) series — AC-powered indoor siren (candidate)
**Confidence:** medium — **unresolved dB conflict, see below**

| Spec | Value | Source |
|---|---|---|
| Sound output | Manufacturer (SRAC-23): 95dB @1m. **Our own live zoveilig.nl product page states 104dB** — conflicts. | Manufacturer: [Climax SRAC-23 Product News PDF](https://www.climax.com.tw/new/downloads/SRAC-23%20Product%20News_20201202.pdf) (95dB); Retailer: [zoveilig.nl/webshop/climax/binnensirene](https://www.zoveilig.nl/webshop/climax/binnensirene) (104dB) |
| Battery backup | 4x AAA Ni-MH (only on the "B" backup variant, e.g. SRAC-23B — base SRAC-23/F1 has none) | Climax SRAC-23 PDF |
| Battery backup life | ~50 days (backup variant only) | same |
| Wireless frequency | 868MHz / 433MHz | same; consistent with [FCC filing for related SRACF1](https://fccid.io/GX9SRACF1/User-Manual/Users-Manual-3241933) |
| Wireless range | niet gevonden — handmatig navragen | — |
| Mounting | Plugs into standard AC outlet (not wall-screwed) | Climax SRAC-23 PDF; corroborated by our own retail copy ("plugs into wall outlet") |

**Notes/flags — needs resolving before publishing:** our own live product page says 104dB, but
the Climax manufacturer datasheet for the AC-powered siren family says 95dB. 104dB actually
matches a *different*, battery-operated Climax siren (SR-32, wall-mounted on batteries) —
inconsistent with our page's own "plugs into outlet" description. **This suggests our current
104dB figure may already be wrong/leftover copy**, independent of anything to do with the new
hover-spec feature — worth a quick fix regardless of Phase 2 timing. Also confirm whether the
actual unit is the base SRAC-23/F1 (no backup battery) or the "B" backup variant, since the
battery-backup rows only apply to the latter.

## CL007 — (Koop) Glasbreukmelder

**Identified as:** Climax ACGS-23ZW "Acoustic Glassbreak Sensor" (Z-Wave), or its ZigBee sibling
ACGS-23ZBS — unconfirmed which
**Confidence:** medium

| Spec | Value | Source |
|---|---|---|
| Detection range | 8m radius to protected glass | [Official Climax ACGS-23ZW datasheet](https://www.securityinformed.com/datasheets/climax-technology-acgs-23zw-intruder-detector/co-9291-ga/ACGS-23ZW.pdf) |
| Detection technology | Acoustic pattern recognition, 4 selectable sensitivity levels | same |
| Battery type | 3V CR123 lithium | same |
| Battery life | 1.8 years (varies with use) | same |
| Wireless frequency | 868.40MHz (EU) / 908.40MHz (US), Z-Wave Plus 500 series | same |
| Wireless range | niet gevonden — handmatig navragen | — |

**Notes/flags:** our zoveilig.nl webshop page for this product returned HTTP 403 during research,
so the SKU→model tie could not be confirmed against our own live copy. If our panel platform
(SecuritasHome) is ZigBee rather than Z-Wave, the ACGS-23ZBS sibling would apply instead — same
8m range and sensitivity levels reported for that model, but no official ZBS datasheet with
battery/frequency figures surfaced. Confirm against the physical packaging or installer portal.

## CL2212 — (Koop) Magneetcontact met shocksensor

**Identified as:** Climax DCSV-29 (Door Contact / Shock Sensor), RF variant DCSV-29-F1 (candidate)
**Confidence:** medium

| Spec | Value | Source |
|---|---|---|
| Max gap/detection distance | ≤15mm between sensor and magnet, closed door | [DCSV-29 Installation Manual](https://www.teletec.se/media/support/documents/1/5/15317646880371.pdf) |
| Shock sensor sensitivity | 3 levels (Low/Med/High); radius varies by surface — glass 0.5/1/1.5m, wood/metal door 0.5/1/2m, concrete 0.25/0.5/1m | same; levels confirmed on [climax.com.tw/dcsv-29.php](https://www.climax.com.tw/dcsv-29.php) |
| Battery type | 3V CR123 lithium | [Official datasheet](https://www.climax.com.tw/new/downloads/DCSV-29_Product_News_20240314.pdf) |
| Battery life | 7 years (varies with use) | same |
| Wireless frequency | 868MHz / 433MHz | same |
| Wireless range | niet gevonden — handmatig navragen ("extensive RF range" stated, no numeric figure given) | — |
| Mounting | Screwed or adhesive-mounted contact body; magnet aligned to rib-marks | Installation Manual |

**Notes/flags:** Climax sells adjacent combo variants (DCSV-32, DCSV-18ZBS, DCSV-23ZBS,
DCSV-29-BUS) — confirm against the supplier packing slip or a product photo which one CL2212
actually is.

## ROL — (Koop) SA-220 Roldeur behuizing

**Identified as:** **Jablotron SA-220** — a different manufacturer than the Climax assumption
this research started with. It's a complete wired magnetic reed contact for roller-shutter/garage
doors, **not a separate housing for some other sensor** as the title ("behuizing") implies.
**Confidence:** medium (manufacturer's own jablotron.com pages returned HTTP 410/404 to automated
fetch — likely JS-rendered, not proof the page doesn't exist; specs corroborated across three
independent EU/NL distributors)

| Spec | Value | Source |
|---|---|---|
| Purpose/sensor type | Wired magnetic reed contact for roller/garage doors; optional wireless relay via JA-60N transmitter or Ajax AJ-DoorProtect(+) input | [alarmsysteemexpert.nl](https://www.alarmsysteemexpert.nl/en/sa-220-roller-door-magnetic-contact-with-floor-con.html); [jaggsalarm.com](https://www.jaggsalarm.com/en/jablotron-sa-220-wired-magnetic-contact-for-rolling-door) |
| Material | niet gevonden — handmatig navragen | — |
| Mounting/dimensions | Reed on floor, magnet on door at ~20mm; max working distance 75mm; body ~106–107×38×10–11mm; 75cm armoured cable | alarmsysteemexpert.nl; [credexalarmsystems.eu](https://www.credexalarmsystems.eu/en/jablotron-sa-220-wired-magnetic-rolling-door-contact.html) |
| IP/weather rating | IP68 | alarmsysteemexpert.nl |

**Notes/flags — two things worth checking:**
- **Product-type mismatch:** our title implies a standalone housing/enclosure for a different
  sensor, but every source found for "SA-220" describes a complete magnetic contact sensor
  (reed + magnet), not an empty housing. Worth confirming with Robi/Robert whether "ROL" really is
  this Jablotron unit or something else.
- **Price discrepancy** (found incidentally, not part of the spec ask): distributors list SA-220
  at roughly €49–€99, well below our current €129,00 buy price — worth a margin sanity check,
  independent of the hover-spec feature.

---
*Research performed 2026-09-11 on `docs/camera-hardware-specs-research` (branched off `main`), via
22 independent web-research passes, one per product in `sections/camera-hardware.liquid`'s `HW`
array. No code was changed. Awaiting Thijs's review before Phase 2 (the hover/tap UI
implementation) begins.*
