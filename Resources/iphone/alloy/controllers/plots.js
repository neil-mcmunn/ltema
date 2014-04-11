function Controller() {
    function editBtn() {
        alert("You Clicked the Edit Button");
    }
    function addBtn() {
        var addPlot = Alloy.createController("addPlot").getView();
        $.navGroupWin.openWindow(addPlot);
    }
    require("alloy/controllers/BaseController").apply(this, Array.prototype.slice.call(arguments));
    this.__controllerPath = "plots";
    arguments[0] ? arguments[0]["__parentSymbol"] : null;
    arguments[0] ? arguments[0]["$model"] : null;
    arguments[0] ? arguments[0]["__itemTemplate"] : null;
    var $ = this;
    var exports = {};
    var __defers = {};
    $.__views.__alloyId22 = Ti.UI.createWindow({
        backgroundColor: "white",
        title: "Plots",
        id: "__alloyId22"
    });
    $.__views.editPlots = Ti.UI.createButton({
        id: "editPlots",
        title: "Edit"
    });
    editBtn ? $.__views.editPlots.addEventListener("click", editBtn) : __defers["$.__views.editPlots!click!editBtn"] = true;
    $.__views.__alloyId22.leftNavButton = $.__views.editPlots;
    $.__views.addPlot = Ti.UI.createButton({
        id: "addPlot",
        title: "Add"
    });
    addBtn ? $.__views.addPlot.addEventListener("click", addBtn) : __defers["$.__views.addPlot!click!addBtn"] = true;
    $.__views.__alloyId22.rightNavButton = $.__views.addPlot;
    var __alloyId26 = [];
    $.__views.row1 = Ti.UI.createTableViewRow({
        title: "Row 1",
        id: "row1"
    });
    __alloyId26.push($.__views.row1);
    $.__views.__alloyId25 = Ti.UI.createTableView({
        data: __alloyId26,
        id: "__alloyId25"
    });
    $.__views.__alloyId22.add($.__views.__alloyId25);
    $.__views.navGroupWin = Ti.UI.iOS.createNavigationWindow({
        window: $.__views.__alloyId22,
        id: "navGroupWin"
    });
    $.__views.navGroupWin && $.addTopLevelView($.__views.navGroupWin);
    exports.destroy = function() {};
    _.extend($, $.__views);
    $.row1.addEventListener("click", function() {
        var observations = Alloy.createController("plotObservations").getView();
        $.navGroupWin.openWindow(observations);
    });
    __defers["$.__views.editPlots!click!editBtn"] && $.__views.editPlots.addEventListener("click", editBtn);
    __defers["$.__views.addPlot!click!addBtn"] && $.__views.addPlot.addEventListener("click", addBtn);
    _.extend($, exports);
}

var Alloy = require("alloy"), Backbone = Alloy.Backbone, _ = Alloy._;

module.exports = Controller;