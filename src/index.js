import "dotenv/config";
import connectDB from "./db/index.js";
import app from "./app.js";

const port = process.env.PORT || 8000;

connectDB().then(() => {
  app.on("error", (error) => {
    console.log("Some error ocurred", error);
  });

  app.listen(port, () => {
    console.log("Application listening on port", port);
  });
});
