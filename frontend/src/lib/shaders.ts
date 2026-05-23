/**
 * Custom GLSL Shaders — ported exactly from Bobby Roe's threejs-earth (update-2024 branch)
 * https://github.com/bobbyroe/threejs-earth/tree/update-2024
 */

// Ported from src/getEarthMat.js
export const EarthShader = {
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      // Position
      vec4 modelPosition = modelMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * viewMatrix * modelPosition;

      // Model normal
      vec3 modelNormal = (modelMatrix * vec4(normal, 0.0)).xyz;

      // Varyings
      vUv = uv;
      vNormal = modelNormal;
      vPosition = modelPosition.xyz;
    }
  `,
  fragmentShader: `
    uniform sampler2D dayTexture;
    uniform sampler2D nightTexture;
    uniform sampler2D cloudsTexture;
    uniform vec3 sunDirection;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      vec3 viewDirection = normalize(vPosition - cameraPosition);
      vec3 normal = normalize(vNormal);
      vec3 color = vec3(0.0);

      // Sun orientation
      float sunOrientation = dot(sunDirection, normal);

      // Day / night color
      float dayMix = smoothstep(- 0.25, 0.5, sunOrientation);
      vec3 dayColor = texture2D(dayTexture, vUv).rgb;
      vec3 nightColor = texture2D(nightTexture, vUv).rgb;
      color = mix(nightColor, dayColor, dayMix);

      // Specular cloud color
      vec2 specularCloudsColor = texture2D(cloudsTexture, vUv).rg;

      // Clouds
      float cloudsMix = smoothstep(0.0, 1.0, specularCloudsColor.g);
      cloudsMix *= dayMix;
      color = mix(color, vec3(1.0), cloudsMix);

      // Final color
      gl_FragColor = vec4(color, 1.0);
    }
  `
};

// Ported from src/getFresnelMat.js
export const AtmosphereShader = {
  vertexShader: `
    uniform float fresnelBias;
    uniform float fresnelScale;
    uniform float fresnelPower;
    
    varying float vReflectionFactor;
    
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
      vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
    
      vec3 worldNormal = normalize( mat3( modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz ) * normal );
    
      vec3 I = worldPosition.xyz - cameraPosition;
    
      vReflectionFactor = fresnelBias + fresnelScale * pow( 1.0 + dot( normalize( I ), worldNormal ), fresnelPower );
    
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  
  fragmentShader: `
    uniform vec3 color1;
    uniform vec3 color2;
    
    varying float vReflectionFactor;
    
    void main() {
      float f = clamp( vReflectionFactor, 0.0, 1.0 );
      gl_FragColor = vec4(mix(color2, color1, vec3(f)), f);
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
      float dash = sin(vUv.x * 100.0 - time * 5.0);
      if (dash < 0.0) discard;
      gl_FragColor = vec4(color, 0.4);
    }
  `
};
