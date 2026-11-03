export function createClipboardRevision(options?:{platform?:string}):{read:()=>string|null;start:()=>Promise<void>;stop:()=>void}
