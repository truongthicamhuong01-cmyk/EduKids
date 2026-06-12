import "./config.js";
import "./firebase-init.js";
import "./services/profileService.js";
import "./services/assignmentService.js";
import "./style.css";

const legacyAppScript = document.createElement("script");
legacyAppScript.src = "/app.js";
legacyAppScript.defer = true;
document.head.appendChild(legacyAppScript);
