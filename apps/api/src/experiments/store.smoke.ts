import * as store from "./store.js";

const exp = store.create("database-outage");
const record0 = store.getRecord(exp.id);
console.log("after create:", record0?.statusHistory);

store.update(exp.id, { status: "STOPPING_DATABASE" });
store.update(exp.id, { status: "STOPPING_DATABASE" });
store.update(exp.id, { status: "DATABASE_DOWN" });

const record1 = store.getRecord(exp.id);
console.log(
  "after updates:",
  record1?.statusHistory.map((entry) => entry.status),
);

const pub = store.get(exp.id);
if (!pub) throw new Error("expected experiment");
console.log("public get has statusHistory:", "statusHistory" in pub);
