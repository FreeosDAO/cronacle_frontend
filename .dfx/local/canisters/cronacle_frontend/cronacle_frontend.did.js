export const idlFactory = ({ IDL }) => {
  return IDL.Service({
    'getUsers' : IDL.Func([], [IDL.Text], []),
    'storeid' : IDL.Func([IDL.Text, IDL.Text], [IDL.Text], []),
  });
};
export const init = ({ IDL }) => { return []; };
