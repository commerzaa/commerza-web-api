'use strict';
/**
 * Exact port of UtilityClass.Encryptword / Decryptword.
 * .NET: TripleDES, ECB, PKCS7, key = MD5(UTF8(key)) (16 bytes => 2-key 3DES / EDE2), output Base64 then
 * "+"->"_plus_", " "->"_space_", "/"->"_slash_", "%"->"_modulo_", "~"->"_tild_", "."->"_dot_".
 * Stored passwords in the existing DB are in this format, so it MUST stay byte-compatible.
 */
const crypto = require('crypto');
const config = require('../config');

const key = () => crypto.createHash('md5').update(Buffer.from(config.encryptionKey, 'utf8')).digest();

function Encryptword(value) {
  try {
    const c = crypto.createCipheriv('des-ede', key(), null); // ECB, PKCS7 padding by default
    let b64 = Buffer.concat([c.update(Buffer.from(String(value), 'utf8')), c.final()]).toString('base64');
    return b64.replace(/\+/g, '_plus_').replace(/ /g, '_space_').replace(/\//g, '_slash_')
      .replace(/%/g, '_modulo_').replace(/~/g, '_tild_').replace(/\./g, '_dot_');
  } catch (e) { return ''; }
}

function Decryptword(text) {
  try {
    const b64 = String(text).replace(/_plus_/g, '+').replace(/_space_/g, ' ').replace(/_slash_/g, '/')
      .replace(/_modulo_/g, '%').replace(/_tild_/g, '~').replace(/_dot_/g, '.');
    const d = crypto.createDecipheriv('des-ede', key(), null);
    return Buffer.concat([d.update(Buffer.from(b64, 'base64')), d.final()]).toString('utf8');
  } catch (e) { return ''; }
}

module.exports = { Encryptword, Decryptword, encryptword: Encryptword, decryptword: Decryptword };
