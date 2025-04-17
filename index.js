const c = require("dotenv");
c.config({ path: "./env/envfile.env" });
const { Telegraf, Markup } = require("telegraf");

const express = require("express");
const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

const ADMIN_ID = process.env.ADMIN_ID;
const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME;

const userState = {};
const pendingAds = {};

bot.start((ctx) => {
  ctx.reply("سلام! برای ثبت آگهی، عنوان آگهی رو بفرست.");
  userState[ctx.chat.id] = { step: "title" };
});

bot.on("text", async (ctx) => {
  const userId = ctx.chat.id;

  if (!userState[userId]) return;

  const state = userState[userId];

  if (state.step === "title") {
    state.title = ctx.message.text;
    state.step = "desc";
    return ctx.reply("توضیحات آگهی رو بفرست.");
  }

  if (state.step === "desc") {
    state.description = ctx.message.text;
    const adText = `📢 آگهی جدید برای بررسی:\n\n📝 *عنوان:* ${state.title}\n📄 *توضیح:* ${state.description}\n👤 از طرف: [${ctx.from.first_name}](tg://user?id=${userId})`;

    pendingAds[userId] = { ...state };

    await bot.telegram.sendMessage(ADMIN_ID, adText, {
      parse_mode: "Markdown",
      reply_markup: Markup.inlineKeyboard([
        Markup.button.callback("✅ تایید", `approve_${userId}`),
        Markup.button.callback("❌ رد", `reject_${userId}`),
      ]),
    });

    delete userState[userId];

    ctx.reply("آگهی شما برای بررسی ارسال شد. پس از تایید، منتشر خواهد شد.");
  }
});

bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const [action, userId] = data.split("_");
  const ad = pendingAds[userId];

  if (!ad) return ctx.answerCbQuery("آگهی یافت نشد یا قبلاً بررسی شده.");

  if (action === "approve") {
    await bot.telegram.sendMessage(
      CHANNEL_USERNAME,
      `📢 *آگهی جدید:*\n\n*عنوان:* ${ad.title}\n*توضیح:* ${ad.description}`,
      {
        parse_mode: "Markdown",
      }
    );

    await bot.telegram.sendMessage(userId, "✅ آگهی شما تایید و منتشر شد.");
    await ctx.reply("آگهی منتشر شد ✅");
  } else if (action === "reject") {
    await bot.telegram.sendMessage(userId, "❌ آگهی شما توسط ادمین رد شد.");
    await ctx.reply("آگهی رد شد ❌");
  }

  delete pendingAds[userId];
  ctx.answerCbQuery();
});

bot.launch();

app.use(bot.webhookCallback("/webhook"));
bot.telegram.setWebhook(`${process.env.SERVER_URL}/webhook`);

app.get("/", (req, res) => {
  res.send("ربات فعاله 🚀");
});

app.listen(3000, () => {
  console.log("Bot server is running...");
});
