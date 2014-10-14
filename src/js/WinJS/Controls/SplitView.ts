import _Base = require('../Core/_Base');
import _SplitView = require('./SplitView/_SplitView');
declare var require: any;

_Base.Namespace.define("WinJS.UI", {
    SplitView: {
        get: () => {
            var module: typeof _SplitView = null;
            require(["./SplitView/_SplitView"], (m: typeof _SplitView) => {
                module = m;
            });
            return module;
        }
    }
});
