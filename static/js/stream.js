"use-strict";

function Streaming() {
  var server = null;
  if (window.location.protocol === 'http:')
    server = "http://" + window.location.hostname + ":8088/janus";
  else
    server = "https://" + window.location.hostname + ":8089/janus";

  var server = [
    "ws://" + window.location.hostname + ":8188",
    "/janus"
  ];
  
  var iceServers = null;

  var janus = null;
  var streaming = null;
  var opaqueId = "streaming-" + Janus.randomString(12);

  var remoteTracks = {}, remoteVideos = 0, dataMid = null;
  var bitrateTimer = {};

  var streamsList = {};
  var selectedStream = null;

  const launchTemp = $("#launch-template").prop("content");
  const streamTemp = $("#stream-template").prop("content");
  const novideoTemp = $("#novideo-template").prop("content");

  const mainContent = $("#main-content");




  Janus.init({
    debug: false,
    callback: function () {
      $('#start').one('click', function () {
        $(this).attr('disabled', true).unbind('click').css({ display: "none" });
        $("#start-loading").css({ display: 'block' });
        if (!Janus.isWebrtcSupported()) {
          toastr.warning("No WebRTC support... ");
          return;
        }

        janus = new Janus(
          {
            server: server,
            iceServers: iceServers,
            success: function () {
              janus.attach(
                {
                  plugin: "janus.plugin.streaming",
                  opaqueId: opaqueId,
                  success: function (pluginHandle) {
                    streaming = pluginHandle;
                    getStreaming();
                  },
                  error: function (error) {

                    bootbox.alert("Error attaching plugin... " + error);
                  },
                  iceState: function (state) {

                  },
                  webrtcState: function (on) {

                  },
                  slowLink: function (uplink, lost, mid) {

                  },
                  onmessage: function (msg, jsep) {
                    if (msg["error"]) {
                      toastr.alert(msg["error"]);
                      return;
                    }
                    if (jsep) {
                      Janus.debug("Handling SDP as well...", jsep);
                      let stereo = (jsep.sdp.indexOf("stereo=1") !== -1);
                      streaming.createAnswer(
                        {
                          jsep: jsep,
                          tracks: [
                            { type: 'data' }
                          ],
                          customizeSdp: function (jsep) {
                            if (stereo && jsep.sdp.indexOf("stereo=1") == -1) {
                              jsep.sdp = jsep.sdp.replace("useinbandfec=1", "useinbandfec=1;stereo=1");
                            }
                          },
                          success: function (jsep) {
                            Janus.debug("Got SDP!", jsep);
                            let body = { request: "start" };
                            streaming.send({ message: body, jsep: jsep });
                          },
                          error: function (error) {
                            Janus.error("WebRTC error:", error);
                            bootbox.alert("WebRTC error... " + error.message);
                          }
                        });
                    }
                  },
                  onremotetrack: function (track, mid, on, metadata) {

                    let mstreamId = "mstream" + mid;
                    if (streamsList[selectedStream] && streamsList[selectedStream].legacy)
                      mstreamId = "mstream0";
                    if (!on) {

                      $('#remotevideo' + mid).remove();
                      if (track.kind === "video") {
                        remoteVideos--;
                        if (remoteVideos === 0) {

                          if ($('#' + mstreamId + ' .no-video-container').length === 0) {
                            $('#' + mstreamId).append(novideoTemp);
                          }
                        }
                      }
                      delete remoteTracks[mid];
                      return;
                    }
                    if ($('#remotevideo' + mid).length > 0)
                      return;

                    let stream = null;
                    if (track.kind === "audio") {

                      stream = new MediaStream([track]);
                      remoteTracks[mid] = stream;

                      $('#' + mstreamId).append('<audio class="hide" id="remotevideo' + mid + '" playsinline/>');
                      $('#remotevideo' + mid).get(0).volume = 0;
                      if (remoteVideos === 0) {

                        if ($('#' + mstreamId + ' .no-video-container').length === 0) {
                          $('#' + mstreamId).append(
                            '<div class="no-video-container audioonly">' +
                            '<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
                            '<span class="no-video-text">No webcam available</span>' +
                            '</div>');
                        }
                        $("#zoom-range").attr("disabled", "disabled");
                        $("#brightness-range").attr("disabled", "disabled");
                      }
                    } else {

                      remoteVideos++;
                      $('.no-video-container').remove();
                      stream = new MediaStream([track]);
                      remoteTracks[mid] = stream;

                      $('#' + mstreamId).append('<video class="centered hide" id="remotevideo' + mid + '" width="100%" height="100%" playsinline/>');
                      $('#remotevideo' + mid).get(0).volume = 0;

                      if (!bitrateTimer[mid]) {
                        $('#curbitrate' + mid).removeClass('hide');
                        bitrateTimer[mid] = setInterval(function () {
                          if (!$("#remotevideo" + mid).get(0))
                            return;

                          let bitrate = streaming.getBitrate(mid);
                          $('#curbitrate' + mid).text(bitrate);

                          let width = $("#remotevideo" + mid).get(0).videoWidth;
                          let height = $("#remotevideo" + mid).get(0).videoHeight;
                          if (width > 0 && height > 0)
                            $('#curres' + mid).removeClass('hide').text(width + 'x' + height).show();
                        }, 1000);

                        $("#brightness-range").removeAttr("disabled");
                        $("#brightness-range").on("change", function () {
                          $("#remotevideo" + mid).css({ filter: 'brightness(' + $(this).val() + '%)' });
                        });


                        $("#zoom-range").removeAttr("disabled");
                        const element = document.querySelector('.panzoom')
                        const panzoom = Panzoom(element, {
                          minScale: 1,
                          startX: 0,
                          startY: 0,
                          startScale: 1,
                          relative: false,
                          contain: "outside"

                        });

                        const parent = element.parentElement
                        parent.addEventListener('wheel', panzoom.zoomWithWheel);

                        const zoomRange = document.getElementById('zoom-range');
                        zoomRange.addEventListener('input', (event) => {
                          panzoom.zoom(event.target.valueAsNumber)
                        });
                        element.addEventListener('panzoomzoom', (event) => {
                          zoomRange.value = event.detail.scale;
                        });
                      }

                    }

                    $("#remotevideo" + mid).bind("playing", function (ev) {
                      $('.waitingvideo').remove();
                      if (!this.videoWidth)
                        return;
                      $('#' + ev.target.id).removeClass('hide').show();
                      let width = this.videoWidth;
                      let height = this.videoHeight;
                      $('#curres' + mid).removeClass('hide').text(width + 'x' + height).show();
                      if (Janus.webRTCAdapter.browserDetails.browser === "firefox") {
                        setTimeout(function () {
                          let width = $('#' + ev.target.id).get(0).videoWidth;
                          let height = $('#' + ev.target.id).get(0).videoHeight;
                          $('#curres' + mid).removeClass('hide').text(width + 'x' + height).show();
                        }, 2000);
                      }
                    });
                    Janus.attachMediaStream($('#remotevideo' + mid).get(0), stream);
                    $('#remotevideo' + mid).get(0).play();
                    $('#remotevideo' + mid).get(0).volume = 1;

                  },

                  ondataopen: function (label, protocol) {
                    $('.waitingvideo').remove();
                  },
                  ondata: function (data) {

                  },
                  oncleanup: function () {
                    $('#video-streaming').empty();
                    for (let i in bitrateTimer)
                      clearInterval(bitrateTimer[i]);
                    bitrateTimer = {};
                    simulcastStarted = false;
                    remoteTracks = {};
                    remoteVideos = 0;
                    dataMid = null;
                  }
                });
            },
            error: function (error) {
              Janus.error(error);
              toastr.error(error);
              setTimeout(function () {
                window.location.reload();
              }, 2000);
            },
            destroyed: function () {
              window.location.reload();
            }
          });
      });
    }
  });



  function getStreaming() {
    let body = { request: "list" };
    streaming.send({
      message: body,
      success: function (result) {
        if (!result) {
          toastr.warning("Got no response to our query for available streams");
          return;
        }

        if (result["list"]) {
          let list = result["list"];
          streamsList = {};
          for (let mp in list) {
            list[mp].legacy = true;
            streamsList[list[mp]["id"]] = list[mp];
            selectedStream = list[mp]["id"];
            startStream();
          }
        }
      }
    });
  }

  function startStream() {
    if (!selectedStream || !streamsList[selectedStream]) {
      toastr.warning("Select a stream from the list");
      return;
    }
    if (streamsList[selectedStream].legacy) {
      let mid = null;
      for (let mi in streamsList[selectedStream].media) {
        let type = streamsList[selectedStream].media[mi].type;
        if (type === "video") {
          mid = streamsList[selectedStream].media[mi].mid;
          break;
        }
      }
      if ($('#mstream0').length === 0) {
        addPanel("0", mid);
        $('#mstream0').append('<video class="rounded centered waitingvideo" id="waitingvideo0" width="100%" height="100%" />');
      }
      dataMid = "0";
    }
    let body = { request: "watch", id: parseInt(selectedStream) || selectedStream };
    streaming.send({ message: body });
  }



  function addPanel(panelId, mid, desc) {
    let temp = $(streamTemp).find("#video-streaming").prop("outerHTML")
      .replace(/{panelId}/ig, panelId)
      .replace(/{mid}/ig, mid);
    mainContent.html(temp);
  }


}

$(document).ready(function () {
  Streaming();
});
