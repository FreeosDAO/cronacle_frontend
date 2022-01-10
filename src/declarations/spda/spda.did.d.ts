import type { Principal } from '@dfinity/principal';
export interface _SERVICE {
  'chat' : (arg_0: string) => Promise<string>,
  'getcls' : () => Promise<string>,
  'storecls' : (arg_0: string) => Promise<string>,
  'storeid' : (arg_0: string, arg_1: string) => Promise<string>,
}
