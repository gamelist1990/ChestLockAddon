export const c = () => ({
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
    },
    admin: "op",
});
