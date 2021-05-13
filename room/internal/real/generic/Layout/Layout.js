global.rooms['internal.real.generic.Layout'] = foundation => {
  return U.form({ name: 'Layout', forms: {}, props: (forms, Form) => ({
    init: C.noFn('init'),
    render: C.noFn('render'),
    install: function(real) { return U.logic.Tmp.stub; },
    isInnerLayout: function() { return false; },
    getChildLayout: function() { return null; },
  })});
};
