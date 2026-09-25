import { solarSunFragment as photosphere } from './solarPhotosphereShader';
import { solarEuvFragment as euv } from './solarEuvShader';

// Both instrument views share one owned GPU program. Switching the uniform
// neither compiles a new material mid-frame nor retains a second texture set.
export const solarSunFragment = /* glsl */ `
${photosphere.replace('void main()', 'void whiteLightMain()')}
${euv.replace(/^(varying .*;|uniform float uTime;)$/gm, '').replace('void main()', 'void extremeUltravioletMain()')}
uniform float uSolarView;
void main() {
  if(uSolarView>.5) extremeUltravioletMain();
  else whiteLightMain();
}
`;
