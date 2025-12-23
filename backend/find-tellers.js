import mongoose from 'mongoose';
import User from './models/User.js';

const searchNames = [
  'Polyanna', 'Mary Clarisse', 'Feby', 'Erika', 'Mary Gold', 'Maria', 'Jenessa', 'Honey', 'Marebelen', 'Mitch'
];

(async () => {
  await mongoose.connect('mongodb://localhost:27017/rmi_teller_report');
  const results = [];
  for (const name of searchNames) {
    const user = await User.findOne({
      $or: [
        { name: new RegExp(name, 'i') },
        { username: new RegExp(name.replace(/\s+/g, ''), 'i') }
      ]
    }).lean();
    if (user) {
      results.push({ name, found: `${user.name} (${user.username})`, id: user._id.toString() });
    } else {
      results.push({ name, found: null });
    }
  }
  console.log(results);
  await mongoose.disconnect();
})();