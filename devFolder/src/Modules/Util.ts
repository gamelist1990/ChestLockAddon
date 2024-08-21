interface CommandConfig {
  enabled: boolean;
  adminOnly: boolean;
  requireTag: string[];
}

export const c = (): { commands: { [key: string]: CommandConfig }, admin: string } => ({
  commands: {
    chest: {
      enabled: true,
      adminOnly: false,
      requireTag: [],
    },
    help: {
      enabled: true,
      adminOnly: false,
      requireTag: [],
    },
    lang: {
      enabled: true,
      adminOnly: false,
      requireTag: [],
    },
    dev: {
      enabled: true,
      adminOnly: true,
      requireTag: [],
    },
    test: {
      enabled: true,
      adminOnly: false,
      requireTag: ["beta"],
    },
    ui: {
      enabled: true,
      adminOnly: false,
      requireTag: [],
    },
  },
  
  admin: "op",
});
