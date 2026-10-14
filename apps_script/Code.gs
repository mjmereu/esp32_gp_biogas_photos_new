// Biogas experiment cameras -> Google Drive, controlled from a Google Sheet.
//
// Container-bound script: create a Google Sheet, then Extensions > Apps Script, and paste this in.
// Run setup() once, then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
//
// Sheet tabs:
//   Config: device | folder_name | enabled   (one row per board; you edit folder_name per sample)
//   Log:    time | device | folder | status | file link   (appended on every upload)
//
// Folders are NEVER created by this script (so a typo can't make a stray folder), except the
// catch-all "Unsorted" folder. You create the sample's folders in Drive yourself, then paste
// their exact names into the Config tab.

var TIMEZONE = "America/New_York";       // used for the timestamp in each file name
var UNSORTED_FOLDER = "Unsorted";        // photos land here if the device/folder can't be resolved
var DEVICES = ["cam_1", "cam_2", "cam_3", "cam_4", "cam_5", "cam_6"];   // rows made by setup()

// Open the web-app URL in a browser to confirm the deployment works.
function doGet(e) {
  return ContentService.createTextOutput("Script is live");
}

function doPost(e) {
  var lock = LockService.getScriptLock();   // boards that wake together take turns
  lock.waitLock(30000);
  var device = "";
  var folderName = "";
  try {
    device = String((e.parameter.device || "")).trim();
    var cfg = lookupDevice_(device);

    if (cfg && cfg.enabled === false) {
      log_(device, cfg.folder, "paused (photo discarded)", "");
      return ContentService.createTextOutput("Paused");
    }

    var bytes = Utilities.base64Decode(e.parameter.data);
    var stamp = Utilities.formatDate(new Date(), TIMEZONE, "yyyyMMdd_HHmmss");
    var label = device || "unknown";
    var blob = Utilities.newBlob(bytes, e.parameter.mimetype || "image/jpeg", label + "_" + stamp + ".jpg");

    var status = "ok";
    var folder = null;
    if (!cfg) {
      status = "unknown device, saved to " + UNSORTED_FOLDER;
    } else if (!cfg.folder) {
      status = "empty folder name, saved to " + UNSORTED_FOLDER;
    } else {
      var found = DriveApp.getFoldersByName(cfg.folder);
      if (found.hasNext()) {
        folder = found.next();
        folderName = cfg.folder;
      } else {
        status = "folder '" + cfg.folder + "' not found, saved to " + UNSORTED_FOLDER;
      }
    }
    if (!folder) folder = unsortedFolder_();

    var file = folder.createFile(blob);
    log_(device, folderName || UNSORTED_FOLDER, status, file.getUrl());
    return ContentService.createTextOutput("Completo");
  } catch (err) {
    log_(device, folderName, "ERROR: " + err, "");
    return ContentService.createTextOutput("Error");
  } finally {
    lock.releaseLock();
  }
}

// Find this board's row in the Config tab. Returns null if the device isn't listed.
// enabled is false only when the checkbox is explicitly unchecked (blank counts as on).
function lookupDevice_(device) {
  var sheet = SpreadsheetApp.getActive().getSheetByName("Config");
  if (!sheet || !device) return null;
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === device.toLowerCase()) {
      var en = rows[i][2];
      var off = (en === false) || (String(en).trim().toLowerCase() === "false");
      return { folder: String(rows[i][1]).trim(), enabled: !off };
    }
  }
  return null;
}

function unsortedFolder_() {
  var it = DriveApp.getFoldersByName(UNSORTED_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(UNSORTED_FOLDER);
}

function log_(device, folder, status, url) {
  var sheet = SpreadsheetApp.getActive().getSheetByName("Log");
  if (sheet) sheet.appendRow([new Date(), device, folder, status, url]);
}

// Run once from the editor: creates the Config and Log tabs.
function setup() {
  var ss = SpreadsheetApp.getActive();

  var config = ss.getSheetByName("Config") || ss.insertSheet("Config");
  if (config.getLastRow() === 0) {
    config.appendRow(["device", "folder_name", "enabled"]);
    DEVICES.forEach(function (d) { config.appendRow([d, "", true]); });
    config.getRange(2, 3, DEVICES.length, 1).insertCheckboxes();
    config.getRange(1, 1, 1, 3).setFontWeight("bold");
    config.setFrozenRows(1);
    config.autoResizeColumns(1, 3);
  }

  var log = ss.getSheetByName("Log") || ss.insertSheet("Log");
  if (log.getLastRow() === 0) {
    log.appendRow(["time", "device", "folder", "status", "file"]);
    log.getRange(1, 1, 1, 5).setFontWeight("bold");
    log.setFrozenRows(1);
  }
}
