// export const sendPickupTemplateBefore10Min = async ( phoneNumber, name ) => {
//   const [firstRaw] = String(name).trim().split(/\s+/);
//   const firstName = firstRaw || name;

//   const url =
//     "https://live-mt-server.wati.io/388428/api/v1/sendTemplateMessages";

//   const payload = {
//     template_name: "pick_up_passenger_notification_before_10_minutes__",
//     broadcast_name: `pick_up_passenger_notification_before_10_minutes__${Date.now()}`,
//     receivers: [
//       {
//         whatsappNumber: phoneNumber,
//         customParams: [
//           {
//             name: "name",
//             value: firstName,
//           },
//         ],
//       },
//     ],
//   };

//   const options = {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json-patch+json",
//       Authorization:
//         "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YmM2MmFkNC04NTQ3LTRkYzItOTc0Ni0wNmRkMjZiODYzNmMiLCJ1bmlxdWVfbmFtZSI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoib21rYXIuamFpc3dhbEBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDYvMzAvMjAyNSAwNzozNzoxNSIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.dr6x_b4olu0EL6oJcEENiD2nMYrlQx5MWlQTJBttcqg", // 🔐 Replace this with an env variable in real apps
//     },
//     body: JSON.stringify(payload),
//   };

//   try {
//     const res = await fetch(url, options);
//     return await res.json();
//   } catch (err) {
//     console.error("Error sending WhatsApp template:", err);
//     throw err;
//   }
// };