/**
 * Custom GLSL Shaders for AstroHedge WebGL Viewport
 */

export const AtmosphereShader = {
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vEyeVec;
    
    void main() {
      // Pass normalized camera-space normal to fragment shader
      vNormal = normalize(normalMatrix * normal);
      
      // Calculate view vector in camera space
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vEyeVec = -normalize(mvPosition.xyz);
      
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  
  fragmentShader: `
    varying vec3 vNormal;
    varying vec3 vEyeVec;
    
    uniform vec3 color;
    uniform float coefficient;
    uniform float power;
    
    void main() {
      // Fresnel effect math
      // Dot product of surface normal and viewing direction
      float dotProd = dot(vNormal, vEyeVec);
      
      // Calculate intensity based on the angle
      float intensity = pow(1.0 - max(dotProd, 0.0), power);
      
      // Output final atmospheric color and fade off at edges
      gl_FragColor = vec4(color, intensity * coefficient);
    }
  `
};

export const OrbitPathShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform float time;
    uniform vec3 color;
    
    void main() {
      // Create a moving dashed line effect along orbital path
      float dash = sin(vUv.x * 100.0 - time * 5.0);
      if (dash < 0.0) discard;
      gl_FragColor = vec4(color, 0.4);
    }
  `
};
