const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("canvas");
const path = require("path");

function registerWelcome(client) {
    client.on("guildMemberAdd", async (member) => {
        try {
            const channel = member.guild.channels.cache.get("1551433761852235978");
            if (!channel) {
                console.error("[Welcome] Channel not found.");
                return;
            }

            const backgroundPath = path.join(__dirname, "welcome.png");
            const background = await loadImage(backgroundPath);

            const canvas = createCanvas(background.width, background.height);
            const ctx = canvas.getContext("2d");
            ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

            // ===== إعدادات صورة العضو =====
            const avatarSize = 260;
            const avatarX = (canvas.width - avatarSize) / 2;
            const avatarY = 140;
            const avatarUrl = member.user.displayAvatarURL({
                extension: "png",
                size: 512
            });
            const avatar = await loadImage(avatarUrl);

            // الإطار الأبيض
            ctx.save();
            ctx.beginPath();
            ctx.arc(
                avatarX + avatarSize / 2,
                avatarY + avatarSize / 2,
                avatarSize / 2 + 8,
                0,
                Math.PI * 2
            );
            ctx.closePath();
            ctx.fillStyle = "#FFFFFF";
            ctx.fill();
            ctx.restore();

            // الصورة الدائرية
            ctx.save();
            ctx.beginPath();
            ctx.arc(
                avatarX + avatarSize / 2,
                avatarY + avatarSize / 2,
                avatarSize / 2,
                0,
                Math.PI * 2
            );
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
            ctx.restore();

            // ===== اسم العضو =====
            const username = member.user.username;
            let fontSize = 60;

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            do {
                ctx.font = `bold ${fontSize}px Arial, sans-serif`;
                if (ctx.measureText(username).width <= canvas.width - 200) break;
                fontSize -= 2;
            } while (fontSize > 24);

            ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
            ctx.shadowBlur = 12;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;

            ctx.fillStyle = "#FFFFFF";
            ctx.fillText(username, canvas.width / 2, 500);

            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            const attachment = new AttachmentBuilder(canvas.toBuffer("image/png"), {
                name: "welcome.png"
            });

            // ===== الرسالة =====
            const message = `حبابك ولله ${member} ❤️👋`;

            await channel.send({ content: message, files: [attachment] });
        } catch (error) {
            console.error("[Welcome] System error:", error);
        }
    });
}

module.exports = { registerWelcome };