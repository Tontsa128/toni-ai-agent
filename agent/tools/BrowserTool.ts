import { BrowserController } from "../browser/BrowserController.js";
import type { ToolDefinition } from "./ToolRegistry.js";
import { ComputerEmergencyStop } from "../computer/ComputerEmergencyStop.js";

const controllers = new Map<string, BrowserController>();

function getController(workspace: string): BrowserController {
  let controller = controllers.get(workspace);
  if (!controller) {
    controller = new BrowserController({ maxTabs: 6 });
    controllers.set(workspace, controller);
  }
  return controller;
}

function objectInput(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) throw new Error("object input is required");
  return input as Record<string, unknown>;
}

function requiredString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${key} is required`);
  return value;
}

export function browserTools(workspace: string, emergencyStop = new ComputerEmergencyStop()): ToolDefinition[] {
  const controller = getController(workspace);
  return [
    {
      name: "browser_tabs",
      description: "List tabs in the isolated browser session.",
      risk: "green",
      execute: async () => controller.tabs()
    },
    {
      name: "browser_open",
      description: "Open a new isolated browser tab at an http/https URL. Reading/navigation is allowed; credentials in URLs are forbidden.",
      risk: "green",
      execute: async (input) => controller.newTab(requiredString(objectInput(input), "url"))
    },
    {
      name: "browser_observe",
      description: "Read the visible page text and a current screenshot from a browser tab. Cookies, storage and credentials are not returned.",
      risk: "green",
      execute: async (input) => {
        const value = objectInput(input);
        const screenshot = value.screenshot === undefined ? true : value.screenshot === true;
        return controller.observe(requiredString(value, "tabId"), screenshot);
      }
    },
    {
      name: "browser_click",
      description: "Click an element in a browser tab. This changes page state and requires human approval.",
      risk: "yellow",
      execute: async (input) => {
        const value = objectInput(input);
        emergencyStop.assertRunning();
        return controller.click(requiredString(value, "tabId"), requiredString(value, "selector"));
      }
    },
    {
      name: "browser_type",
      description: "Fill a form field in a browser tab. This changes page state and requires human approval.",
      risk: "yellow",
      execute: async (input) => {
        const value = objectInput(input);
        emergencyStop.assertRunning();
        return controller.type(requiredString(value, "tabId"), requiredString(value, "selector"), requiredString(value, "text"));
      }
    },
    {
      name: "browser_navigate",
      description: "Navigate an existing browser tab to an http/https URL. Navigation may change remote state and requires human approval.",
      risk: "yellow",
      execute: async (input) => {
        const value = objectInput(input);
        emergencyStop.assertRunning();
        return controller.navigate(requiredString(value, "tabId"), requiredString(value, "url"));
      }
    }
  ];
}
