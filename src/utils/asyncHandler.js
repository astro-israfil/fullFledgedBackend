// const asyncHandler = (fn) => async (req, res, next) => {
//   try {
//     await fn(req, res, next);
//   } catch (error) {
//     res.status(500);
//     res.send({
//       success: false,
//       message: error.message,
//     });
//   }
// };

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  });
};

export default asyncHandler;
