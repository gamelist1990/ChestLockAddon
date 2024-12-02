import { Server } from 'socket-be';
import * as uuid from 'uuid';



const server = new Server({
    port: 8000,
    timezone: 'Asia/Tokyo',
});

server.events.on('serverOpen', async () => {
    console.log('サーバが起動');
    

});

server.events.on('worldAdd', async(event) => {
    console.log('worldと接続完了!');
    const {world} = event;
    world.subscribeEvent('PlayerBounced');
})






function safeStringify(obj) {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
                return; 
            }
            seen.add(value);
        }
        return value;
    }, 2);
}

server.events.on('packetReceive', async (event) => {
    console.log("発火");
    const bodyAndHeader = {
        body: event.packet.body,
        header: event.packet.header
    };
    console.log(JSON.stringify(bodyAndHeader, null, 2));
});

server.events.on('', async (event) => {
    console.log("発火");
    const bodyAndHeader = {
        body: event.packet.body,
        header: event.packet.header
    };
    console.log(JSON.stringify(bodyAndHeader, null, 2));
});





