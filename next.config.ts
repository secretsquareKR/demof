

/** @type {import('next').NextConfig} */
const nextConfig = {

    // 포트 번호(:3000)까지 정확하게 명시해 줍니다.
    allowedDevOrigins: [
      '192.168.50.10',
      '192.168.50.10:3000', 
      'localhost:3000',
      '*.local:3000'
    ]
  
};

export default nextConfig;
