global.rooms['internal.real.generic.Layout'] = foundation => {
  let { Tmp } = U.logic;
  return U.form({ name: 'Layout', forms: { Tmp }, props: (forms, Form) => ({
    render: C.noFn('render'),
    doInstall: function(real) {
      if (this.installedReal) throw new Error(`${U.getFormName(this)} has already been applied`);
      this.installedReal = real;
      return this.install(real);
    },
    install: function(real) { return Tmp.stub; },
    isInnerLayout: function() { return false; },
    getChildLayout: function() { return null; },
  })});
};
