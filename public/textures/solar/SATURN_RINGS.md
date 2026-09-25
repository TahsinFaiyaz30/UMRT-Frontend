# Saturn ring optical-depth profile

`saturn-ring-profile.webp` contains a measured radial opacity profile, not an
illustration, an upscaled planet photograph, or procedurally invented stripes.
The closed ring geometry and scattering shader turn these measurements into a
three-dimensional, illuminated particle layer.

## Observation

- Mission/instrument: NASA/ESA/ASI Cassini UVIS High Speed Photometer.
- Observation: Theta Carinae ingress, 2013 day 141 (21 May 2013).
- Product: `UVIS_HSP_2013_141_THECAR_I_TAU01KM`, PDS dataset
  `CO-SR-UVIS-HSP-2/4-OCC-V3.0`, published by the NASA PDS Ring-Moon Systems Node.
- Source radial sampling: 1 km; observation quality: **GOOD**; stellar elevation
  above the ring plane: 67 degrees.
- [PDS observation label](https://pds-rings.seti.org/holdings/volumes/COUVIS_8xxx/COUVIS_8001/data/UVIS_HSP_2013_141_THECAR_I_TAU01KM.LBL)
- [PDS numerical table](https://pds-rings.seti.org/holdings/volumes/COUVIS_8xxx/COUVIS_8001/data/UVIS_HSP_2013_141_THECAR_I_TAU01KM.TAB)
- [PDS instrument and occultation archive](https://pds-rings.seti.org/cassini/uvis/)

The source table SHA-256 is
`7d4c607268be137fc3d07e2831dcf8b40b6bc372cf857aa06dd7cd27e63aea32`.

## Reduction and sampling

The asset is a 4096 by 1 pixel **lossless WebP**, containing the 74,000–141,000 km
radial interval. A texel represents 16.357421875 km, so this is a downsampling of
observations, not additional fabricated spatial resolution. R, G, and B contain
the same eight-bit scalar. Load with `THREE.NoColorSpace`, ordinary mipmaps, and
linear filtering; applying sRGB decoding would corrupt the measurements.

For each source row within the interval, use column 1 (ring radius in km), column
5 (normal optical depth, tau), and column 12 (quality flags). Reject missing tau
`-1` and flags 32 or 64. All bins in the selected interval have valid data.

1. Assign a row to `floor((radius - 74000) / 67000 * 4096)`.
2. Average **transmission** `exp(-tau)` within each bin.
3. Encode `round(255 * clamp(1 - meanTransmission, 0, 1))` in R, G, and B.
4. Reconstruct `tau = -log(max(1 - texture.r, 0.0025))` in the shader.

Negative values slightly below zero are measurement noise. Averaging transmission
before clamping avoids positively biasing clear gaps by clamping every individual
negative sample. Texture mipmaps also average transmission; distant narrow gaps
and ringlets consequently retain their integrated coverage instead of flickering.
The strongest opaque areas saturate at tau approximately 5.99; this visual asset
is not suitable for recovering scientific optical depths or conducting research.

## Rendering and limitations

Ring radii use Saturn's 60,268 km equatorial radius. Main C/B/A structure, the
Cassini Division, and the Encke/Keeler gaps come from the observation. Geometry
must overlap the radius of any feature to display it; the data also include the
F-ring crossing, whose eccentric radius in this particular observation is near
140,490 km. It is not a universal circular F-ring radius.

The shader uses the measured tau for view-angle attenuation and for the ring
shadow cast onto Saturn. It approximates single scattering through a flat
particle layer on the illuminated and transmitted faces. The dense B ring is
bright from its illuminated face and darker in transmission, matching the
qualitative Cassini behavior. The closed mesh is rendered with front faces only
so the entrance and exit boundaries do not count opacity twice.

Visible-light albedo and the particle phase function are a restrained photometric
model. UVIS is ultraviolet occultation data, **not** a visible-color photograph.
Azimuthal wakes, individual particle collisions, time-dependent spokes, and
multiple scattering are not solved. A single historical radial cut is treated
as azimuthally representative; the display does not claim to show current ring
conditions.

Additional primary references:

- [NASA Saturnian Rings Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html): ring radii and typical optical depths/albedos.
- [Cassini natural-color radial mosaic, PIA11142](https://science.nasa.gov/photojournal/a-full-sweep-of-saturns-rings/): broad color and lit/unlit appearance comparison, NASA/JPL/Space Science Institute.
- [NASA ring review, Cuzzi et al.](https://www.nasa.gov/wp-content/uploads/2018/03/rings-of-saturn-2018-review-chapter.pdf): optical-depth and ring photometry context.

## Observed visible reflectance variation

`saturn-ring-color.webp` adds a separate, **sRGB color** profile from Cassini's
natural-color radial mosaic **PIA11142**, observed on 26 November 2008. Credit:
NASA/JPL/Space Science Institute. This is the image described in the natural-color
reference above; it was assembled from red, green, and blue ISS images, not
ultraviolet false-color imagery.

- [Source JPEG](https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia11/pia11142/PIA11142.jpg?crop=faces%2Cfocalpoint&fit=clip&h=1439&w=12126)
- Retrieved decoded dimensions: 12,198 by 1,439 pixels.
- Source SHA-256: `758184b99efb2c0a3d1350ce7aed13cdfcadb1a43c31aa26de860e5380dc4658`.
- Mean 33 central rows, `y = 703..735`, in **linear RGB** to suppress camera noise
  without smearing the curved ring structures far from the central radial cut.
- Approximate radial registration is piecewise linear between the C inner edge
  (`x = 1144`, 74,658 km), B inner edge (`x = 3841`, 91,975 km), B outer edge
  (`x = 8149`, 117,507 km), and A outer edge (`x = 11130`, 136,780 km).
  This avoids spreading the stitched mosaic's inner/outer differences in scale
  into an incorrect C/B boundary. The final segment is extended for pixels
  outside the main rings.
- Pixel-area resample onto the same 74,000–141,000 km, 4096-pixel radial domain as
  the opacity data, convert back to sRGB, and store as lossless WebP. No generated
  detail, noise, sharpening, contrast exaggeration, or pixel upscaling is added.

This registration is an approximate visual alignment of a published mosaic, not
the mission's calibrated map-projection geometry. The image's original viewing
angle, illumination, particle wakes, and optical depth all affect its brightness.
It supplies observed color and radial reflectance variation; it must **not** be
described as a calibrated intrinsic albedo or used to override the independently
measured opacity. In particular, the bright B ring retains observed fine
variation even where optical depth is too high for opacity alone to reveal it.
The faint F ring was observed at a different epoch and eccentric radius from the
UVIS cut, so its visible color should retain the approximate icy-particle model.

To avoid attenuating the C ring twice, the renderer divides out the source-view
single-scattering layer factor before applying the live scene's transfer. The
published observing elevation is 10 degrees; solar elevation is fitted at 4
degrees for this near-equinox image. That second angle is an approximation, not
a recovered mission ephemeris. A constant 0.9 exposure normalization and a maximum
0.95 albedo bound keep the proxy physically bounded without enhancing contrast.
