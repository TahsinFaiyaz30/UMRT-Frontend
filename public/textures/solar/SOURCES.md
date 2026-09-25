# Solar System surface maps

These maps are used on smooth, three-dimensional meshes in the Teams space
journey. They are observational mosaics and educational reconstructions, not
live weather or a complete, uniformly resolved survey. An image texture is a
surface material; it is not a billboard or a replacement for 3D geometry.

Downloaded 25 September 2026. The initial maps were converted to WebP at quality
94; higher-resolution replacements and lossless relief products are specified
in the update sections below. Mercury is 8192 pixels wide, Jupiter 7200,
Pluto 5926 and Charon 6144. Other parent maps retain source detail up to 4096
pixels; smaller satellites generally retain up to 2048, with Moon and Io at
4096. No source is upscaled. These assets are identical on every
device. Source resolution, survey coverage, color calibration,
and stitching limit the detail that can honestly be shown. Missing areas in
Pluto and Charon maps use a feathered, featureless neutral material rather than
invented craters or dark atlas caps; see their update below. Unobserved black atlas pixels on Titania and Oberon are rendered as
featureless neutral material rather than falsely depicting black surface ice.
The images represent different observation dates.

## Initial credits and sources

The Mercury, Jupiter, Pluto and Charon rows below record the original assets;
their current replacements, processing and credits are documented in the
corresponding update sections. The remaining rows describe current files.

| Local file | Source and credit | Source width → stored width |
| --- | --- | --- |
| earth.webp | [NASA Blue Marble, December 2004](https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74518/world.topo.200412.3x5400x2700.jpg), Reto Stöckli / NASA Earth Observatory | 5400 → 4096 |
| earth-clouds.webp | [NASA Blue Marble clouds](https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg), NASA GSFC / Reto Stöckli; a multi-day composite, not current clouds | 2048 → 2048 |
| earth-night.webp | [NASA 2012 night lights](https://eoimages.gsfc.nasa.gov/images/imagerecords/79000/79765/dnb_land_ocean_ice.2012.3600x1800.jpg), NASA Earth Observatory / NOAA Suomi NPP; historical city-light distribution | 3600 → 3600 |
| mercury.webp | [NOAA SOS Mercury](https://sos.noaa.gov/catalog/datasets/mercury/), NASA / JHUAPL / Carnegie MESSENGER global monochrome mosaic; [file](https://sos.noaa.gov/ftp_mirror/astronomy/mercury/oct2011/4096.jpg) | 4096 → 4096 |
| mars.webp | [NOAA SOS Mars](https://sos.noaa.gov/catalog/datasets/mars/), NASA exploration imagery, NOAA / David Himes; [file](https://sos.noaa.gov/ftp_mirror/astronomy/mars/original/4096.jpg) | 4096 → 4096 |
| jupiter.webp | [NOAA SOS Jupiter image](https://sos.noaa.gov/ftp_mirror/astronomy/jupiter/still/4096.jpg), spacecraft cloud mosaic distributed for NOAA's educational globe; historical Great Red Spot and cloud bands | 4096 → 4096 |
| saturn.webp | [NOAA SOS Saturn](https://sos.noaa.gov/catalog/datasets/saturn/), Björn Jónsson, NOAA / Steve Albers; true-color educational reconstruction with representative cloud features; [file](https://sos.noaa.gov/ftp_mirror/astronomy/saturn/original/2880.jpg) | 2880 → 2880 |
| uranus.webp | [NOAA SOS Uranus](https://sos.noaa.gov/catalog/datasets/uranus/), James Hastings-Trew, NOAA / Steve Albers; representative visible cloud layer, not a resolved surface survey; [file](https://sos.noaa.gov/ftp_mirror/astronomy/uranus/original/1024.jpg) | 1024 → 1024 |
| neptune.webp | [NOAA SOS Neptune](https://sos.noaa.gov/catalog/datasets/neptune/), Voyager, Björn Jónsson, NOAA / Steve Albers; historical atmosphere reconstruction; [file](https://sos.noaa.gov/ftp_mirror/astronomy/neptune/2048.jpg) | 2048 → 2048 |
| moon.webp | [LROC WAC mosaic via NOAA](https://sos.noaa.gov/ftp_mirror/astronomy/moon/lroc/LROCwacmosaic.jpg), NASA / GSFC / Arizona State University LRO mission; monochrome observed lunar terrain | 4096 → 4096 |
| pluto.webp | [New Horizons map via NOAA](https://sos.noaa.gov/ftp_mirror/astronomy/pluto/4096.png), NASA / JHUAPL / Southwest Research Institute; variable-resolution New Horizons coverage | 4096 → 4096 |
| charon.webp | [NOAA SOS Charon](https://sos.noaa.gov/catalog/datasets/charon-plutos-moon/), NASA New Horizons, NOAA / Steve Albers; [file](https://sos.noaa.gov/ftp_mirror/astronomy/charon/4096.jpg) | 4096 → 4096 |
| io.webp | [USGS Io mosaic via NOAA](https://sos.noaa.gov/ftp_mirror/astronomy/io/usgs/4096.jpg), NASA / JPL / USGS Voyager and Galileo data | 4096 → 4096 |
| europa.webp | [Europa mosaic via NOAA](https://sos.noaa.gov/ftp_mirror/astronomy/europa/2048.jpg), NASA / JPL spacecraft imagery, NOAA / Steve Albers | 2048 → 2048 |
| ganymede.webp | [Ganymede mosaic via NOAA](https://sos.noaa.gov/ftp_mirror/astronomy/ganymede/2048.jpg), NASA / JPL spacecraft imagery, NOAA / Steve Albers | 2048 → 2048 |
| callisto.webp | [Callisto mosaic via NOAA](https://sos.noaa.gov/ftp_mirror/astronomy/callisto/2048.jpg), NASA / JPL spacecraft imagery, NOAA / Steve Albers | 2048 → 2048 |
| rhea.webp | [Rhea mosaic via NOAA](https://sos.noaa.gov/ftp_mirror/astronomy/rhea/2048.jpg), NASA / JPL Cassini and Voyager imagery, NOAA / Steve Albers | 2048 → 2048 |
| iapetus.webp | [Iapetus mosaic via NOAA](https://sos.noaa.gov/ftp_mirror/astronomy/iapetus/2048.jpg), NASA / JPL Cassini and Voyager imagery, NOAA / Steve Albers | 2048 → 2048 |
| titania.webp | [Titania mosaic via NOAA](https://sos.noaa.gov/ftp_mirror/astronomy/uranus_moons/titania/2048.jpg), NASA / JPL Voyager imagery, NOAA / Steve Albers | 2048 → 2048 |
| oberon.webp | [Oberon mosaic via NOAA](https://sos.noaa.gov/ftp_mirror/astronomy/uranus_moons/oberon/2048.jpg), NASA / JPL Voyager imagery, NOAA / Steve Albers | 2048 → 2048 |
| triton.webp | [Triton mosaic via NOAA](https://sos.noaa.gov/ftp_mirror/astronomy/triton/2048.jpg), NASA / JPL Voyager imagery, NOAA / Steve Albers | 2048 → 2048 |
| phobos.webp | [Phobos mosaic via NOAA](https://sos.noaa.gov/ftp_mirror/astronomy/mars_moons/phobos/2048.jpg), NASA / JPL spacecraft imagery, NOAA / Steve Albers | 2048 → 2048 |
| deimos.webp | [Deimos mosaic via NOAA](https://sos.noaa.gov/ftp_mirror/astronomy/mars_moons/deimos/1024.jpg), NASA / JPL spacecraft imagery, NOAA / Steve Albers | 1024 → 1024 |

## Rendering interpretation

- The Sun defaults to NASA/SDO AIA 304 Å observations on a rotating 3D sphere,
  with three simulated volumetric prominences and a thin emitting atmosphere.
  Observed active regions, loops and dark filaments replace the old procedural
  H-alpha noise. The warm glow belongs to this EUV display; no white eclipse
  corona is mixed into it. The historical composite is explicitly labelled:
  its orange/red palette is instrument false colour, not naked-eye colour.
  White light remains a separate procedural view with representative sunspots,
  granulation and limb darkening. Neither mode claims a live observation or
  a recovered three-dimensional plasma measurement. See the solar atlas below.
- Venus is an opaque, pale cloud globe. Radar relief is deliberately not shown
  through its clouds. Titan is likewise an opaque amber haze globe; infrared
  surface maps are not presented as a visible-light view.
- Neptune's original release texture is strongly saturated. The shader keeps
  its cloud structure and maps luminance to a subdued blue-green palette,
  informed by [Oxford's corrected visible appearance study](https://www.ox.ac.uk/news/2024-01-05-new-images-reveal-what-neptune-and-uranus-really-look-0).
  This is an approximation, not a scientific color-calibration product.
- Atmospheres use thin 3D shells and angle-dependent scattering. Earth has a
  separate cloud shell, ocean glint, night lights, and moon occultation. Cloud
  movement is an illustrative advection of the observed composite, not a weather
  forecast. Saturn's radial opacity comes from a Cassini UVIS occultation;
  reflectance modulation comes from a Cassini natural-color mosaic. Both
  datasets and their interpretation are documented in [SATURN_RINGS.md](./SATURN_RINGS.md).
  Uranus and Neptune have faint narrow rings.
- Planet shapes include gas-giant oblateness. Satellite sizes retain their
  physical ratios to the parent; Phobos and Deimos use approximate ellipsoid
  aspect ratios. Major moons are included, not every known small satellite.
- Orbital and axial motion share a clock of 3600 physical seconds per visible
  second. Kepler's equation supplies eccentric orbits. Satellite orbits are
  compressed independently into 2.2–6.2 parent radii for inspection, so displayed
  distances are not an astronomical scale model. Tidal locking, axial obliquity,
  and Triton's retrograde direction are retained. Initial phases are illustrative,
  not a current ephemeris. Planet-centered inspection views use changing Sun
  direction as the planet follows its evaluated orbit.

## Reuse

NASA/NOAA federal material is not subject to US copyright protection unless
otherwise indicated. Processed maps retain the credits above; availability on a
government host does not transfer a third party's rights. NOAA states that
third-party SOS media is made available for educational, journalistic, and
personal use; other reuse can require permission from its creator. This
university-team visualization is educational. See [NOAA's media policy](https://sos.noaa.gov/copyright/)
and [NASA image-use guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/).
No NASA, NOAA, or contributor endorsement is implied.

## Measured relief and Jupiter detail update, 25 September 2026

This update supersedes the general 4096-pixel limit above for Jupiter. The
same committed maps are used on every device; quality is not reduced according
to device type. No albedo brightness was interpreted as elevation, and no
procedural craters were added to the Moon or Mars data.

| Local file | Observations and processing | Stored size |
| --- | --- | --- |
| moon-normal.webp | NASA LRO LOLA [LDEM_16 PDS product](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_16.lbl), NASA GSFC / LOLA Science Team; area-reduced measured elevations, physical spherical gradients | 4096 × 2048, lossless RGB |
| moon-height.webp | The same LOLA grid, area-reduced and packed into two channels without loss after quantization | 1024 × 512, lossless RGB |
| mars-normal.webp | NASA MGS MOLA [MEGT90N000EB PDS product](https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/megt90n000eb.lbl), NASA GSFC / MOLA Science Team; area-reduced measured elevations, physical spherical gradients | 4096 × 2048, lossless RGB |
| mars-height.webp | The same MOLA grid, area-reduced and packed into two channels without loss after quantization | 1024 × 512, lossless RGB |
| jupiter.webp | [NASA/ESA Hubble WFC3 OPAL map, 27 June 2019](https://esahubble.org/images/heic1914b/), NASA, ESA, A. Simon (NASA GSFC), M. H. Wong (UC Berkeley); [7200 × 3196 source JPEG](https://cdn.esahubble.org/archives/images/large/heic1914b.jpg). Its measured central cloud map retains native resolution. Polar strips use the earlier NOAA-distributed educational mosaic cited above, with a 2° blend at each coverage boundary. | 7200 × 3600, WebP quality 97 |

LOLA and MOLA are laser altimeters: these relief maps encode survey-derived
surface shape, independently of photographic illumination. The original grids
are 5760 × 2880 (16 samples per degree), with north at the top and longitude
increasing eastward from 0° at the left edge to 360° at the right. This is the
same longitude convention as the existing NOAA Moon and Mars color maps.
Olympus Mons, Valles Marineris, lunar maria and prominent crater rims were
visually checked for map alignment. The source grids include interpolation
between observation tracks; their resolution does not support invented
sub-pixel rocks or micro-craters.

The Moon source stores signed little-endian 16-bit half-metres relative to a
1737400 m reference sphere; measured values in this product range from
−8981.5 to +10685.5 m. Mars uses signed big-endian 16-bit metres relative to its
areoid (GMM3 gravity model), ranging from −8177 to +21171 m. For the rendered
Mars globe, the relief gradient uses the product's 3396000 m reference radius.
Applying areoid-relative relief to that reference sphere is a visualization
approximation rather than a complete gravity/geoid shape model.

Normal maps are linear data, not sRGB. RGB encodes XYZ from −1 to +1: +X follows
increasing u/east, +Y follows increasing v/north, +Z points out of the surface.
Gradients account for latitude and each body's physical radius, with no
vertical exaggeration. Longitude wraps; latitude clamps at the poles. Both
lossless WebP products are decoded after generation and compared byte-for-byte
against their source RGB buffers.

Height maps store the high byte in R and low byte in G; B is unused. Decode
`DN = dot(texture.rg, vec2(65280.0, 255.0))`. Moon metres are
`DN * 0.5 - 10000.0`; Mars metres are `DN - 12000.0`. The linear combination
also preserves bilinear interpolation across byte boundaries: do not round
the individual sampled channels. Load both normal and height maps with
`NoColorSpace`, and do not apply a gamma transform.

The Jupiter map is a historical cloud observation, not current weather. Hubble
coverage ends at approximately ±79.9° latitude. Its gaps are not filled with
invented storm patterns: the lower-resolution NOAA polar material is retained,
including the unresolved, nearly uniform extreme polar areas already present
in that product. This is a documented composite of different epochs, not a
single complete 2019 survey. The source Hubble filters are 395, 502 and 631 nm;
its published visible-color composite is retained rather than claiming exact
human-eye color calibration. [ESA/Hubble image-use conditions](https://esahubble.org/copyright/)
apply in addition to the existing NASA/NOAA credits.

`node scripts/prepare-solar-relief.mjs` reproducibly downloads the raw PDS grids
in bounded ranges, computes the maps and prepares the Jupiter composite. Large
original archives remain in the ignored `.next/solar-relief-source` cache and
are not downloaded at runtime or during a normal build. Input SHA-256 hashes:

- LOLA LDEM_16: `a511e40d7a3ea3275945b4da2a1df377133264fab0be94b7434b1cf8907254cb`
- MOLA MEGT90N000EB: `d18d9b9ab8c5516d02e157dd2cde0f1d0d160c21940e953ba22391269a545e7b`

Each 4K normal map costs 32 MiB decoded RGBA and approximately 42.7 MiB of GPU
storage including mipmaps; each 1K height map costs 2 MiB decoded and about
2.7 MiB with mipmaps. Jupiter costs approximately 98.9 MiB decoded and
131.8 MiB with mipmaps. These maps are acquired only with their owning encounter
and released when that encounter leaves the bounded resident set. Compressed
file sizes do not describe GPU memory use.

## Mercury surface and measured relief update, 25 September 2026

This update supersedes the older 4K Mercury mosaic above. Credits: NASA /
MESSENGER Team, Arizona State University, Johns Hopkins Applied Physics
Laboratory, Carnegie Science, Applied Coherent Technology Corporation and
USGS Astrogeology Science Center; DEM authors K. J. Becker and colleagues.

| Local file | Source and processing | Stored size |
| --- | --- | --- |
| mercury.webp | [MESSENGER MDIS BDR monochrome basemap](https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_global_basemap_bdr_166m), assembled from NASA Trek's level-4 tile pyramid | 8192 × 4096, WebP quality 97 |
| mercury-normal.webp | [USGS MESSENGER Global DEM, version 2](https://astrogeology.usgs.gov/search/map/mercury_messenger_global_dem_665m), area-reduced survey elevations and physical spherical gradients | 4096 × 2048, lossless RGB |
| mercury-height.webp | The same DEM, area-reduced and packed into RG channels | 1024 × 512, lossless RGB |

The BDR source is a 750-nm monochrome reflectance mosaic selected for surface
morphology, not a calibrated RGB photograph or a pure illumination-free albedo
map. Some historical photographic shadows remain. The 8K atlas samples a
higher-resolution survey without inventing or enlarging small craters.
NASA Trek's [WMTS capabilities](https://trek.nasa.gov/tiles/Mercury/EQ/Mercury_MESSENGER_MDIS_Basemap_BDR_Mosaic_Global_166m/1.0.0/WMTSCapabilities.xml)
specify a north-up −180° to +180° grid. The preparation script rotates the atlas
by half its width into the renderer's 0° to 360° east longitude convention.

The 23040 × 11520 DEM was derived from overlapping MESSENGER MDIS images, not
image brightness. Its GeoTIFF stores little-endian signed 16-bit values with a
0.5 m multiplier and a 2439400 m reference sphere. The script validates the
embedded scale, offset, no-data value, strip layout and projection before
decoding. It rejects missing output cells and generates no substitute terrain.
The decoded source elevations range from −5382 to +4497 m, with no unresolved
output cells. Caloris and Rembrandt crater features were visually checked
against their independently generated relief to confirm map registration.
The stored relief retains the measured vertical scale. RGB normal directions
and packed-height interpolation follow the Moon/Mars contract above; Mercury
metres decode as `DN * 0.5 - 10000.0`. These are linear data textures.

Run `node scripts/prepare-mercury-relief.mjs` to reproduce the assets. Raw
archives and downloaded tiles remain in the ignored
`output/playwright/solar-source-cache` directory, outside Next's temporary
build directory. They are never fetched during page loads. The 8K surface map
uses 128 MiB decoded RGBA, or approximately 170.7 MiB with GPU mipmaps; normal
and height maps add approximately 45.3 MiB with mipmaps. Encounter ownership
and pruning release these maps together when Mercury leaves the resident set.

Raw DEM SHA-256:
`e6c9faee55180f8727f329ecd8ec41d10d76ce470ef041c1d848378453394fd9`.
Both lossless data textures are decoded and compared byte-for-byte with the
computed RGB buffers during preparation.

## Pluto and Charon coverage correction, 25 September 2026

This replaces the older Pluto and Charon assets in the original table. The
previous Charon atlas encoded missing southern observations as a hard dark
cap, and the previous Pluto atlas used a blurred reconstruction over much of
the view. Those atlas conventions must not be presented as observed terrain.

| Local file | Source and processing | Stored size |
| --- | --- | --- |
| pluto.webp | [NASA New Horizons global color mosaic, January 2017](https://science.nasa.gov/resource/pluto-global-color-map/), NASA / JHUAPL / SwRI; observed MVIC color map at its original dimensions, with its no-data southern area represented as neutral material | 5926 × 2963, WebP quality 97 |
| charon.webp | [USGS New Horizons LORRI/MVIC mosaic, July 2017](https://astrogeology.usgs.gov/search/map/charon_new_horizons_lorri_mvic_global_mosaic_300m), NASA / JHUAPL / SwRI / LPI / USGS, Paul Schenk and colleagues; source 12693 × 6347 reduced to 6144 × 3072. Luminance comes from this observed mosaic; broad color ratios come from the NOAA New Horizons color map credited in the original table, smoothed before compositing to avoid duplicating old edge detail | 6144 × 3072, WebP quality 97 |
| pluto-coverage.webp, charon-coverage.webp | Observation masks derived from the continuous southern no-data area of each source, including the visual feather at the boundary; white represents retained observations and black represents unobserved neutral material | 1024 × 512 each, lossless grayscale |

The maps retain north-up equirectangular projection. The detailed encounter
hemispheres are near the horizontal center, `u = 0.5`; Charon's USGS product
uses positive-east 0–360° longitude. Pluto's Sputnik Planitia is near the
center of the NASA color release. Neither map is uniformly resolved: lower
resolution approach observations remain visibly softer, and no sharpening
or invented surface features disguise that limitation. The color fusion for
Charon is a visualization composite, not a new radiometrically calibrated
color data product. The original photographic illumination is retained.

[NASA's map-release explanation](https://www.nasa.gov/missions/new-horizons-unveils-new-maps-of-pluto-charon-on-flyby-anniversary/)
states that terrain south of about 30°S was dark during the flyby. The
continuous missing region connected to the bottom edge is therefore assigned
a uniform neutral material, feathered over 5.4° within the observed boundary.
This removes false black caps without pretending the missing terrain was
photographed. The neutral values (sRGB 158/148/138 for Pluto, 157/155/151 for
Charon) are display choices, not measured southern albedo. Observed dark
terrain, including Charon's reddish northern Mordor Macula, is preserved.
Coverage masks are documentation assets and are not loaded by the renderer.

Run `node scripts/prepare-pluto-maps.mjs` to reproduce these files. Sources stay
in `output/playwright/solar-source-cache`, outside Next.js build directories.
The combined decoded RGBA footprint is about 139.0 MiB (185.3 MiB including
estimated GPU mipmaps), independent of device type. Existing encounter leases
release both maps when this encounter leaves the resident set. The script
checks decoded map dimensions and verifies that the southern no-data material
remains opaque neutral RGB rather than disappearing during bitmap decoding.

## Sun observation rebuild, 25 September 2026

`sun-aia304.webp` is an **8192 × 4096**, quality-97 WebP atlas derived from
4096-pixel NASA Solar Dynamics Observatory / Atmospheric Imaging Assembly
304 Å browse images. Credit: **NASA/SDO and the AIA science team**.

| Observation (UTC) | Role and original image |
| --- | --- |
| 2026-08-31 00:09:06 | [Rotation phase before the central image](https://sdo.gsfc.nasa.gov/assets/img/browse/2026/08/31/20260831_000906_4096_0304.jpg) |
| 2026-09-09 00:09:06 | [Central observation and inspection targets](https://sdo.gsfc.nasa.gov/assets/img/browse/2026/09/09/20260909_000906_4096_0304.jpg) |
| 2026-09-18 00:09:30 | [Rotation phase after the central image](https://sdo.gsfc.nasa.gov/assets/img/browse/2026/09/18/20260918_000930_4096_0304.jpg) |
| 2026-03-07 01:09:42 | [Southern-pole coverage only](https://sdo.gsfc.nasa.gov/assets/img/browse/2026/03/07/20260307_010942_4096_0304.jpg) |

Run `node scripts/prepare-sun-observation.mjs` to reproduce the atlas. It fits
solar disk boundaries, inverse-projects the north-up observations onto the
sphere, and blends overlapping views in linear RGB, favoring frontal data.
It does not wrap a photograph of a circular disk directly around a sphere.
Nominal synodic rotation and ±7.2° B0 angles provide approximate registration;
this is a historical visualization composite, not a calibrated FITS/WCS data
product or a simultaneous whole-Sun exposure. Active regions change between
observations. The original instrument false-color palette is retained, with
an exposure adjustment in the renderer.

The March observation feathers in between 55° and 75° south. Approximately
0.2853% of spherical area remains unobserved; these small transition patches
fade to the mean observed color at that latitude, without invented texture.
The missing fraction in the equirectangular image is larger (1.054%) because
that projection stretches the poles. Source SHA-256 hashes, registration,
coverage statistics and measured bright-region directions are recorded in
[sun-observation.json](sun-observation.json).

The display uses a smooth 3D sphere and differential rotation. Observed EUV
brightness is emission, not measured elevation, and is never turned into
rock-like displacement. Three compact 3D density fields supply flowing,
absorbing/emitting prominence sheets using 48 ray samples each. A separate
48-sample spherical volume supplies the thin EUV limb; both stop at the opaque
Sun. These plasma volumes are representative simulations, not tomography of
the dated observations. The former sandpaper shader, wire arches and broad
white halo have been removed from the default view.

The atlas costs 128 MiB decoded RGBA, approximately 170.7 MiB with mipmaps.
It is acquired only by the Sun encounter. Sun/Mercury opening readiness waits
for it; eviction closes its decoded bitmap and releases its GPU texture.
No source photographs, second full-resolution solar map, or intermediate
projection buffers are retained by the browser. Filter changes reuse the
same material and atlas. Sources are downloaded during offline preparation
into the ignored `output/playwright/solar-source-cache` directory.
