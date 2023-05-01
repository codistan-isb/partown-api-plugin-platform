export default async function (userId, Trades, Catalog, Ownership) {
  const trades = await Trades.find({ createdBy: userId }).toArray();
  console.log("trades are ", trades);
  const chartData = {};
  trades.forEach((trade) => {
    const date = new Date(trade.createdAt);

    console.log("date is ", date);
    const month = `${date.getMonth() + 1}-${date.getFullYear()}`;

    console.log("month is ", month);
    if (!chartData[month]) {
      chartData[month] = {
        month: `${date.toLocaleString("default", {
          month: "short",
        })} ${date.getFullYear()}`,
        totalInvested: 0,
        currentValue: 0,
      };
    }
    chartData[month].totalInvested += trade.price;
  });

  console.log("chart data is ", chartData);

  const products = await Catalog.find({}).toArray();

  console.log("product are ", products);

  products.forEach((product) => {
    const date = new Date(product.updatedAt);
    const month = `${date.getMonth() + 1}-${date.getFullYear()}`;
    if (chartData[month]) {
      chartData[month].currentValue +=
        product.product.area.price *
        Object.values(product.product.area.value).reduce(
          (total, val) => total + val,
          0
        );
    }
  });

  const currentMonth = `${
    new Date().getMonth() + 1
  }-${new Date().getFullYear()}`;
  const performance = chartData[currentMonth]
    ? chartData[currentMonth].currentValue -
      chartData[currentMonth].totalInvested
    : 0;

  console.log("chart data is ", chartData);

  const totalInvested = [];
  const currentValue = [];

  for (let i = 1; i <= 12; i++) {
    const month = `${i}-${new Date().getFullYear()}`;
    if (!chartData[month]) {
      totalInvested.push(0);
      currentValue.push(0);
    } else {
      totalInvested.push(chartData[month].totalInvested);
      currentValue.push(chartData[month].currentValue);
    }
  }

  console.log("performance is ", performance);

  return { totalInvested, currentValue, performance };
}
