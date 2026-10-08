import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
export function secret() { return randomBytes(32).toString('hex'); }
export function createCrypto(encryptionKey:string,hashKey:string) {
  for (const key of [encryptionKey,hashKey]) if (!/^[a-f0-9]{64}$/i.test(key)) throw new Error('Keys must each contain 64 hex characters');
  const key=Buffer.from(encryptionKey,'hex');
  return {
    hash(value:string) { return createHmac('sha256',Buffer.from(hashKey,'hex')).update(value).digest('hex'); },
    seal(value:string,context:string) {
      const iv=randomBytes(12); const cipher=createCipheriv('aes-256-gcm',key,iv); cipher.setAAD(Buffer.from(context));
      const ciphertext=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
      return ['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),ciphertext.toString('base64')].join('.');
    },
    open(envelope:string,context:string) {
      const [version,iv,tag,data]=envelope.split('.'); if(version!=='v1')throw new Error('Unknown encryption version');
      const cipher=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64'));cipher.setAAD(Buffer.from(context));cipher.setAuthTag(Buffer.from(tag,'base64'));
      return Buffer.concat([cipher.update(Buffer.from(data,'base64')),cipher.final()]).toString('utf8');
    }
  };
}
export type CryptoService=ReturnType<typeof createCrypto>;
