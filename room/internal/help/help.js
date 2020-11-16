global.rooms['internal.help'] = foundation => ({ open: async () => {
  console.log(`Showing help:`);
  let { settle, ...origArgs } = foundation.origArgs;
  let computedArgs = await Promise.allObj(origArgs.map((v, k) => foundation.getArg(k)));
  console.log(`Arguments supplied:`, origArgs);
  console.log(`These resolved to:`, computedArgs);
}});
