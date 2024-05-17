// app.js

const { App, LogLevel } = require("@slack/bolt");
require("dotenv").config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  logLevel: LogLevel.DEBUG,
});

// Slash command to trigger the approval modal
app.command("/approval-test", async ({ ack, body, client }) => {
  await ack();

  try {
    // Fetch users to populate the dropdown
    const result = await client.users.list();
    const users = result.members
      .filter((member) => !member.is_bot && member.id !== body.user_id)
      .map((member) => ({
        text: {
          type: "plain_text",
          text: member.profile.real_name || member.name,
        },
        value: member.id,
      }));

    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "approval_modal",
        title: {
          type: "plain_text",
          text: "Request Approval",
        },
        blocks: [
          {
            type: "input",
            block_id: "approver_block",
            label: {
              type: "plain_text",
              text: "Select Approver",
            },
            element: {
              type: "static_select",
              action_id: "approver",
              options: users,
            },
          },
          {
            type: "input",
            block_id: "approval_text_block",
            label: {
              type: "plain_text",
              text: "Approval Text",
            },
            element: {
              type: "plain_text_input",
              multiline: true,
              action_id: "approval_text",
            },
          },
        ],
        submit: {
          type: "plain_text",
          text: "Submit",
        },
      },
    });
  } catch (error) {
    console.error("err");
  }
});

// Handle modal submission
app.view("approval_modal", async ({ ack, body, view, client }) => {
  await ack();

  const approverId =
    view.state.values.approver_block.approver.selected_option.value;
  const approvalText =
    view.state.values.approval_text_block.approval_text.value;
  const requesterId = body.user.id;

  try {
    await client.chat.postMessage({
      channel: approverId,
      text: `Approval request from <@${requesterId}>`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Approval Request*\n${approvalText}`,
          },
        },
        {
          type: "actions",
          block_id: "approval_action",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Approve",
              },
              style: "primary",
              value: JSON.stringify({ requesterId, approvalText }),
              action_id: "approve_button",
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Reject",
              },
              style: "danger",
              value: JSON.stringify({ requesterId, approvalText }),
              action_id: "reject_button",
            },
          ],
        },
      ],
    });
  } catch (error) {
    console.error(error);
  }
});

// Handle approve button click
app.action("approve_button", async ({ ack, body, client }) => {
  await ack();

  const { requesterId } = JSON.parse(body.actions[0].value);

  try {
    await client.chat.postMessage({
      channel: requesterId,
      text: `Your approval request has been *approved* by <@${body.user.id}>.`,
    });

    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: `Approval request from <@${requesterId}> has been approved.`,
      blocks: [],
    });
  } catch (error) {
    console.error(error);
  }
});

// Handle reject button click
app.action("reject_button", async ({ ack, body, client }) => {
  await ack();

  const { requesterId } = JSON.parse(body.actions[0].value);

  try {
    await client.chat.postMessage({
      channel: requesterId,
      text: `Your approval request has been *rejected* by <@${body.user.id}>.`,
    });

    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: `Approval request from <@${requesterId}> has been rejected.`,
      blocks: [],
    });
  } catch (error) {
    console.error(error);
  }
});

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log("⚡️ Bolt app is running!");
})();
