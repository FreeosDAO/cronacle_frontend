export const idlFactory = ({ IDL }) => {
  return IDL.Service({
    'chat' : IDL.Func([IDL.Text], [IDL.Text], []),
    'getcls' : IDL.Func([], [IDL.Text], []),
    'storecls' : IDL.Func([IDL.Text], [IDL.Text], []),
    'storeid' : IDL.Func([IDL.Text, IDL.Text], [IDL.Text], []),
  });
};
export const init = ({ IDL }) => { return []; };
