function updateProductPrice(data) {
  const apiUrl = "http://localhost:8000/price/";

  var myHeaders = new Headers();
  myHeaders.append("Authorization", "Bearer very-secret-token");
  myHeaders.append("Content-Type", "application/json");

  var raw = JSON.stringify({
    "url": data.url,
    "name": data.name,
    "image_url": data.imageUrl,
    "price": data.value,
    "rating": data.rating,
    "sold": data.sold,
  });

  var requestOptions = {
    method: 'POST',
    headers: myHeaders,
    body: raw,
    redirect: 'follow'
  };

  fetch(apiUrl, requestOptions)
    .then(response => response.text())
    .then(result => {})
    .catch(error => {});
}
