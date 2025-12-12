export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  
  database: {
    url: process.env.DATABASE_URL,
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  cors: {
    origins: process.env.CORS_ORIGINS || 'http://localhost:4200',
  },
  
  push: {
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
    fcmServerKey: process.env.FCM_SERVER_KEY,
    apnsKeyId: process.env.APNS_KEY_ID,
    apnsTeamId: process.env.APNS_TEAM_ID,
    apnsAuthKey: process.env.APNS_AUTH_KEY,
  },
  
  storage: {
    s3Bucket: process.env.S3_BUCKET,
    s3Region: process.env.S3_REGION || 'ap-northeast-2',
    s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  
  sentry: {
    dsn: process.env.SENTRY_DSN,
  },
  
  app: {
    env: process.env.APP_ENV || 'development',
  },
});
