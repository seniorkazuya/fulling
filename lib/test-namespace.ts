import { k8sService } from './kubernetes';

console.log('Testing namespace retrieval...');
const namespace = k8sService.getDefaultNamespace();
console.log('Namespace:', namespace);
console.log('Type:', typeof namespace);
console.log('Is null?', namespace === null);
console.log('Is undefined?', namespace === undefined);
console.log('Is empty?', namespace === '');