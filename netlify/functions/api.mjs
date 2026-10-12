import { getStore } from '@netlify/blobs';
import { createCloudHandler } from '../../backend/cloud.js';

export default async function handler(request) {
  const store = getStore({ name: 'projeto-integrador', consistency: 'strong' });
  return createCloudHandler(store)(request);
}

export const config = {
  path: ['/api', '/api/*'],
};
