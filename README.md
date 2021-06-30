Monitor the scheduled pressing of fronts

### Reasoning

Press periodically presses all fronts at different priorities. If error happens they are reported, however if the scheduler break, the error stream remains silent.

This lambda periodically checks that fronts with different priorities are scheduled correctly.



### Unit tests

The lambda fetches secrets from an S3 bucket.

Set the bucket name with

```
export FRONT_PRESSED_LAMBDA_BUCKET="bucket-name"
```

* `npm test` to run your tests once.
* `nodemon --exec 'npm test' --ignore tmp` to watch your files and run tests on save.
