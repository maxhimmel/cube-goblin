import type { AboutPanelOptionsOptions } from "electron";
import { app } from "electron";

export const FAN_CONTENT_NOTICE =
  "Cube Goblin is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.";

export function aboutPanel(): AboutPanelOptionsOptions {
  return {
    applicationName: app.getName(),
    applicationVersion: app.getVersion(),
    credits: `Card data and images from Scryfall.\n\n${FAN_CONTENT_NOTICE}`,
    copyright: "© 2026 Max Himmel. MIT License.",
  };
}
