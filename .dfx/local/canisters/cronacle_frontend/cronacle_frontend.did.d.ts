import type { Principal } from '@dfinity/principal';
export interface _SERVICE {
  'getUsers' : () => Promise<string>,
  'storeid' : (arg_0: string, arg_1: string) => Promise<string>,
}
