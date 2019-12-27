var md = new Remarkable();
let currentQueries = getQueryObj();
if (!Object.keys(currentQueries).length < 1) {
  if (currentQueries.project != undefined) {
      // Content placeholder
      let projectSrc = `js/blog/content/${currentQueries.project}.md`;
      console.log(`Searching for ${projectSrc}`);
      $("#projects").empty();

      // fetch md content
      $.ajax({
        url: projectSrc,
        contentType: "text/plain",
        success: function (data) {
          console.log(data);
          console.log(md.render(data));
        },
        error: function (e, status, errStr) {
          console.log(e);
          console.log(status);
          console.log(errStr);
        }
      });
  }
}
