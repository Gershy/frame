global.rooms['internal.real.generic.Layout'] = foundation => {
  let { Tmp } = U.logic;
  return U.form({ name: 'Layout', has: { Tmp }, props: (forms, Form) => ({
    render: C.noFn('render'),
    install: function(real) { return Tmp.stub; },
    isInnerLayout: function() { return false; },
    getChildLayout: function() { return null; }
  })});
};
