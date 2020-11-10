global.rooms['hinterlands.hutControls'] = async foundation => {
  
  let { RecSrc, RecScope } = await foundation.getRoom('record');
  
  return U.form({ name: 'HutControls', props: (forms, Form) => ({
    
    $FollowRecScope: U.form({ name: 'FollowRecScope', has: { RecScope }, props: (forms, Form) => ({
      init: function(hut, ...args) {
        
        this.hut = hut;
        
        // Our src will send Recs if using either of these styles:
        // 1 - `RecScope(srcTmp, 'relTerm', (rec, dep) => ...)`
        // 2 - `RecScope(srcTmp.relSrc('relTerm'), (rec, dep) => ...)`
        this.doFollowRecs = args.count() === 3 || U.isForm(args[0], RecSrc);
        forms.RecScope.init.call(this, ...args);
      },
      processTmp: function(tmp, dep) {
        if (this.doFollowRecs) dep(this.hut.followRec(tmp));
        return forms.RecScope.processTmp.call(this, tmp, dep);
      },
      subScope: function(...args) { return forms.RecScope.subScope.call(this, this.hut, ...args); }
    })}),
    
    init: function(fullName, { debug, habitats=[], recForms={}, parFn=()=>{}, kidFn=()=>{} }) {
      ({}).gain.call(this, { fullName, debug, habitats, recForms, parFn, kidFn });
    },
    open: async function(hut) {
      
      let tmp = U.logic.Tmp();
      
      hut.roadDbgEnabled = this.debug.has('hinterlands');
      
      let name = this.fullName.split('.')[1];
      for (let h of this.habitats) tmp.endWith(h.prepare(name, hut));
      //let habitats = this.habitats.map(HabitatForm => HabitatForm(name, hut));
      //tmp.endWith(() => habitats.each(h => h.end()));
      
      hut.addTypeClsFns(this.recForms.map(RecForm => () => RecForm));
      tmp.endWith(()=> hut.remTypeClsFns(this.recForms.toArr((v, k) => k)));
      
      let real = await foundation.seek('real', 'primary');
      
      /// {ABOVE=
      
      hut.createRec(this.fullName, [ hut ]);
      let parScope = RecScope(hut, this.fullName, (rec, dep) => {
        this.parFn(rec, hut, real, dep);
        dep.scp(hut, 'lands.kidHut/par', (kidParHut, dep) => {
          let kidHut = kidParHut.mems.kid;
          dep(Form.FollowRecScope(kidHut, hut, this.fullName, (rec, dep) => this.kidFn(rec, kidHut, real, dep)));
        });
      });
      tmp.endWith(parScope);
      
      /// =ABOVE} {BELOW=
      
      // As soon as Below syncs the root Rec it's good to go
      let kidScope = Form.FollowRecScope(hut, hut, this.fullName, (rec, dep) => this.kidFn(rec, hut, real, dep));
      tmp.endWith(kidScope);
      
      /// =BELOW}
      
      return tmp;
      
    }
    
  })});
  
};
