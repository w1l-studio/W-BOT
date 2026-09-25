const fs = require("node:fs");
const path = require("node:path");

const {
    AttachmentBuilder
} = require("discord.js");

const {
    createCanvas,
    loadImage
} = require("canvas");

const gifFrames = require("gif-frames");
const GIFEncoder = require("gif-encoder-2");

const DEFAULT_GIF =
    path.join(__dirname, "welcome.gif");

const DEFAULT_FONT =
    '700 34px "Arial"';

const WELCOME_CHANNEL_ID =
    "1551433761852235978";

let registered = false;


// ======================================================
// GET WELCOME CHANNEL
// ======================================================

function getWelcomeChannelId() {
    return WELCOME_CHANNEL_ID;
}


// ======================================================
// STREAM -> BUFFER
// ======================================================

async function streamToBuffer(stream) {

    if (Buffer.isBuffer(stream)) {
        return stream;
    }

    if (stream instanceof Uint8Array) {
        return Buffer.from(stream);
    }

    if (
        stream &&
        typeof stream.then === "function"
    ) {
        return streamToBuffer(
            await stream
        );
    }

    if (
        stream &&
        typeof stream[Symbol.asyncIterator] === "function"
    ) {

        const chunks = [];

        for await (const chunk of stream) {

            chunks.push(
                Buffer.isBuffer(chunk)
                    ? chunk
                    : Buffer.from(chunk)
            );
        }

        return Buffer.concat(chunks);
    }

    if (
        stream &&
        typeof stream.on === "function"
    ) {

        return new Promise(
            (resolve, reject) => {

                const chunks = [];

                stream.on(
                    "data",
                    chunk => {

                        chunks.push(
                            Buffer.isBuffer(chunk)
                                ? chunk
                                : Buffer.from(chunk)
                        );
                    }
                );

                stream.once(
                    "end",
                    () => {

                        resolve(
                            Buffer.concat(chunks)
                        );
                    }
                );

                stream.once(
                    "error",
                    error => {

                        reject(error);
                    }
                );
            }
        );
    }

    throw new TypeError(
        `Unsupported image stream type: ${typeof stream}`
    );
}


// ======================================================
// ROUNDED CLIP
// ======================================================

function roundedClip(
    ctx,
    x,
    y,
    width,
    height,
    radius
) {

    const r =
        Math.min(
            radius,
            width / 2,
            height / 2
        );

    ctx.beginPath();

    ctx.moveTo(
        x + r,
        y
    );

    ctx.arcTo(
        x + width,
        y,
        x + width,
        y + height,
        r
    );

    ctx.arcTo(
        x + width,
        y + height,
        x,
        y + height,
        r
    );

    ctx.arcTo(
        x,
        y + height,
        x,
        y,
        r
    );

    ctx.arcTo(
        x,
        y,
        x + width,
        y,
        r
    );

    ctx.closePath();
}


// ======================================================
// CREATE WELCOME GIF
// ======================================================

async function createWelcomeGif(
    member,
    gifPath = DEFAULT_GIF
) {

    if (!fs.existsSync(gifPath)) {

        throw new Error(
            `Welcome GIF not found: ${gifPath}`
        );
    }

    const avatarUrl =
        member.user.displayAvatarURL({
            extension: "png",
            size: 256,
            forceStatic: true
        });

    const avatar =
        await loadImage(avatarUrl);

    const frames =
        await gifFrames({
            url: gifPath,
            frames: "all",
            outputType: "png",
            cumulative: true
        });

    if (
        !frames ||
        !frames.length
    ) {

        throw new Error(
            "The welcome GIF contains no frames."
        );
    }

    const firstFrameBuffer =
        await streamToBuffer(
            frames[0].getImage()
        );

    const firstImage =
        await loadImage(
            firstFrameBuffer
        );

    const width =
        firstImage.width;

    const height =
        firstImage.height;

    const encoder =
        new GIFEncoder(
            width,
            height,
            "neuquant",
            false
        );

    encoder.setRepeat(0);
    encoder.setQuality(10);
    encoder.start();


    // ==================================================
    // PROCESS FRAMES
    // ==================================================

    for (const frame of frames) {

        const frameBuffer =
            await streamToBuffer(
                frame.getImage()
            );

        const background =
            await loadImage(
                frameBuffer
            );

        const canvas =
            createCanvas(
                width,
                height
            );

        const ctx =
            canvas.getContext("2d");


        // ==================================================
        // BACKGROUND
        // ==================================================

        ctx.drawImage(
            background,
            0,
            0,
            width,
            height
        );


        // ==================================================
        // PROFILE PANEL
        // ==================================================

        const panelWidth =
            Math.min(
                width - 70,
                410
            );

        const panelHeight =
            185;

        const panelX =
            (width - panelWidth) / 2;

        const panelY =
            Math.max(
                18,
                height / 2 - 100
            );

        ctx.save();

        ctx.fillStyle =
            "rgba(0, 0, 0, 0.28)";

        roundedClip(
            ctx,
            panelX,
            panelY,
            panelWidth,
            panelHeight,
            22
        );

        ctx.fill();

        ctx.restore();


        // ==================================================
        // AVATAR
        // ==================================================

        const avatarSize =
            Math.min(
                128,
                Math.floor(
                    height * 0.34
                )
            );

        const avatarX =
            (width - avatarSize) / 2;

        const avatarY =
            panelY + 16;

        ctx.save();

        ctx.beginPath();

        ctx.arc(
            avatarX +
                avatarSize / 2,

            avatarY +
                avatarSize / 2,

            avatarSize / 2 + 4,

            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            "#FFFFFF";

        ctx.fill();

        ctx.beginPath();

        ctx.arc(
            avatarX +
                avatarSize / 2,

            avatarY +
                avatarSize / 2,

            avatarSize / 2,

            0,
            Math.PI * 2
        );

        ctx.clip();

        ctx.drawImage(
            avatar,
            avatarX,
            avatarY,
            avatarSize,
            avatarSize
        );

        ctx.restore();


        // ==================================================
        // USERNAME
        // ==================================================

        const username =
            `@${member.user.username}`;

        ctx.font =
            DEFAULT_FONT;

        ctx.textAlign =
            "center";

        ctx.textBaseline =
            "middle";

        ctx.save();

        ctx.shadowColor =
            "rgba(0, 0, 0, 0.85)";

        ctx.shadowBlur =
            8;

        ctx.shadowOffsetX =
            0;

        ctx.shadowOffsetY =
            2;

        ctx.fillStyle =
            "#FFFFFF";

        ctx.fillText(
            username,
            width / 2,
            avatarY + avatarSize + 29,
            panelWidth - 30
        );

        ctx.restore();


        // ==================================================
        // FRAME TIMING
        // ==================================================

        const delay =
            Number(
                frame.frameInfo?.delay || 10
            ) * 10;

        encoder.setDelay(
            Math.max(
                20,
                delay
            )
        );

        encoder.addFrame(ctx);
    }


    encoder.finish();

    const output =
        encoder.out.getData();

    if (
        !output ||
        !Buffer.isBuffer(output) ||
        output.length === 0
    ) {

        throw new Error(
            "GIF encoder returned an empty buffer."
        );
    }

    return output;
}


// ======================================================
// REGISTER WELCOME
// ======================================================

function registerWelcome(client) {

    if (registered) {

        console.log(
            "[WELCOME] Already registered. Skipping duplicate registration."
        );

        return;
    }

    registered = true;


    client.on(
        "guildMemberAdd",

        async member => {

            try {

                // ==========================================
                // IGNORE BOTS
                // ==========================================

                if (member.user.bot) {
                    return;
                }


                // ==========================================
                // CHANNEL
                // ==========================================

                const channelId =
                    getWelcomeChannelId();

                const channel =
                    await member.guild.channels.fetch(
                        channelId
                    );

                if (
                    !channel ||
                    !channel.isTextBased()
                ) {

                    console.error(
                        "[WELCOME] Welcome channel is invalid."
                    );

                    return;
                }


                // ==========================================
                // CHECK BOT PERMISSIONS
                // ==========================================

                const me =
                    member.guild.members.me ||
                    await member.guild.members.fetch(
                        client.user.id
                    );

                const permissions =
                    channel.permissionsFor(me);

                if (
                    !permissions ||
                    !permissions.has("SendMessages") ||
                    !permissions.has("AttachFiles")
                ) {

                    console.error(
                        "[WELCOME] Bot does not have SendMessages or AttachFiles permission."
                    );

                    return;
                }


                // ==========================================
                // CREATE GIF
                // ==========================================

                console.log(
                    `[WELCOME] Creating welcome GIF for ${member.user.tag}...`
                );

                const gifBuffer =
                    await createWelcomeGif(
                        member
                    );

                console.log(
                    `[WELCOME] GIF created successfully: ${gifBuffer.length} bytes`
                );


                // ==========================================
                // ATTACHMENT
                // ==========================================

                const attachment =
                    new AttachmentBuilder(
                        gifBuffer,
                        {
                            name: "welcome.gif"
                        }
                    );


                // ==========================================
                // SEND EVERYTHING IN ONE MESSAGE
                // ==========================================

                const message =
                    await channel.send({
                        content:
                            `حبابك ولله <@${member.id}> ❤️👋`,

                        files: [
                            attachment
                        ],

                        allowedMentions: {
                            users: [
                                member.id
                            ]
                        }
                    });


                // ==========================================
                // SUCCESS
                // ==========================================

                console.log(
                    `[WELCOME] Welcome message sent successfully. Message ID: ${message.id}`
                );

            } catch (error) {

                console.error(
                    "========================================"
                );

                console.error(
                    "[WELCOME] FAILED"
                );

                console.error(
                    error
                );

                console.error(
                    "========================================"
                );
            }
        }
    );


    console.log(
        "[WELCOME] Welcome system registered successfully."
    );
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    registerWelcome,

    createWelcomeGif,

    getWelcomeChannelId

};